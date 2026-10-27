import json
import os
import datetime
import urllib.request
import boto3

dynamodb = boto3.resource("dynamodb")
bedrock = boto3.client("bedrock-runtime", region_name="af-south-1")

NOTES_TABLE = os.environ.get("NOTES_TABLE")
TRANSCRIBE_REGION = os.environ.get("TRANSCRIBE_REGION", "af-south-1")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-micro-v1:0")

transcribe_client = boto3.client("transcribe", region_name=TRANSCRIBE_REGION)


def structure_note_with_ai(transcript: str) -> dict:
    """
    Sends the raw transcript to an LLM to clean and structure it.
    Returns a cleaned, structured note: { title, summary, cleanedText, status, todos }
    """
    prompt = f"""You are a voice note assistant. A user recorded a voice note and it was auto-transcribed. The transcription contains filler words, hesitations, and informal speech.

Raw transcript:
\"\"\"{transcript}\"\"\"

Your job:
1. Clean the transcript — remove all filler words and hesitations (um, uh, uhh, like, so, you know, I mean, basically, literally, right, okay so, etc). Fix grammar. Keep the meaning intact.
2. Extract a short title (max 5 words, no punctuation at end, title case).
3. Write one clear summary sentence of what the note is about.
4. Determine status: "Done" if the speaker describes something already completed, otherwise "Planned".
5. Extract a list of specific actionable todos from the note. Each todo should be a clear action item. If there are no todos, return an empty array.

Return ONLY a valid JSON object with these exact fields:
{{
  "title": "Short Title Here",
  "summary": "One sentence summary.",
  "cleanedText": "The cleaned version of the transcript.",
  "status": "Planned",
  "todos": ["Action item one", "Action item two"]
}}

No explanation, no markdown, just the JSON object."""

    text = ""
    try:
        response = bedrock.converse(
            modelId=BEDROCK_MODEL_ID,
            messages=[
                {
                    "role": "user",
                    "content": [{"text": prompt}],
                }
            ],
            inferenceConfig={
                "maxTokens": 1024,
                "temperature": 0.0,
            },
        )
        text = response["output"]["message"]["content"][0]["text"].strip()
    except Exception as e:
        try:
            response = bedrock.invoke_model(
                modelId=BEDROCK_MODEL_ID,
                contentType="application/json",
                accept="application/json",
                body=json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 1024,
                    "messages": [{"role": "user", "content": prompt}],
                }),
            )
            result = json.loads(response["body"].read())
            if "content" in result and isinstance(result["content"], list):
                text = result["content"][0].get("text", "").strip()
            elif "output" in result:
                text = str(result.get("output", "")).strip()
            else:
                text = str(result).strip()
        except Exception:
            raise

    # Strip markdown code fences if wrapped
    if "```" in text:
        # Extract content between code fences
        parts = text.split("```")
        for p in parts:
            p2 = p.strip()
            if p2.startswith("json"):
                p2 = p2[4:].strip()
            if p2.startswith("{") and p2.endswith("}"):
                text = p2
                break
        else:
            if text.startswith("```"):
                text = parts[1] if len(parts) > 1 else text
                if text.strip().startswith("json"):
                    text = text.strip()[4:]
            text = text.strip()

    try:
        return json.loads(text)
    except Exception:
        # Try to find JSON object in text
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def lambda_handler(event, context):
    detail = event.get("detail", {})
    job_name = detail.get("TranscriptionJobName", "")

    # Job name format: VoiceNote_<userId>_<noteId>
    parts = job_name.split("_", 2)
    if len(parts) < 3:
        return {"statusCode": 400, "body": "Invalid job name"}

    user_id = parts[1]
    note_id = parts[2]

    # Fetch the finished transcription job to get the transcript URL
    job = transcribe_client.get_transcription_job(TranscriptionJobName=job_name)
    job_detail = job["TranscriptionJob"]
    transcript_uri = job_detail["Transcript"]["TranscriptFileUri"]

    # Derive audio file extension from the original S3 URI
    media_uri = job_detail.get("Media", {}).get("MediaFileUri", "")
    audio_ext = media_uri.rsplit(".", 1)[-1] if "." in media_uri else "webm"

    # Download and parse the Transcribe output JSON
    with urllib.request.urlopen(transcript_uri) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    transcripts = body.get("results", {}).get("transcripts", [])
    raw_text = transcripts[0].get("transcript", "") if transcripts else ""

    # Use Claude Haiku to clean the transcript and extract structured fields
    try:
        structured = structure_note_with_ai(raw_text)
        title = structured.get("title", "Voice Note")
        summary = structured.get("summary", "")
        cleaned_text = structured.get("cleanedText", raw_text)
        status = structured.get("status", "Planned")
        todos = structured.get("todos", [])
    except Exception as ai_error:
        # AI failed — save with raw transcript so the note still appears
        print(f"Bedrock structuring failed: {ai_error}")
        title = "Voice Note"
        summary = ""
        cleaned_text = raw_text
        status = "Planned"
        todos = []

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    table = dynamodb.Table(NOTES_TABLE)
    table.put_item(Item={
        "userId": user_id,
        "noteId": note_id,
        "text": cleaned_text,
        "rawText": raw_text,
        "title": title,
        "summary": summary,
        "status": status,
        "todos": todos,
        "createdAt": now,
        "updatedAt": now,
        "audioKey": f"audio/{user_id}/{note_id}.{audio_ext}",
    })

    return {"statusCode": 200, "body": json.dumps({"noteId": note_id, "status": status})}
