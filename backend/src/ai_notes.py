import json
import os
import boto3

# Nova Micro is not available in af-south-1, so Bedrock calls default to us-east-1.
DEFAULT_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-micro-v1:0")
DEFAULT_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")

_clients = {}


def _get_client(region_name):
    if region_name not in _clients:
        _clients[region_name] = boto3.client("bedrock-runtime", region_name=region_name)
    return _clients[region_name]


def _build_prompt(transcript):
    return f"""You are a voice note assistant. A user recorded a voice note and it was auto-transcribed. The transcription contains filler words, hesitations, and informal speech.

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


def _parse_response(text):
    text = text.strip()

    if "```" in text:
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
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start:end + 1])
        raise


def structure_note_with_ai(transcript, model_id=None, region_name=None):
    """Clean and structure a transcript with Bedrock.

    Returns a dict with title, summary, cleanedText, status and todos.
    """
    model_id = model_id or DEFAULT_MODEL_ID
    region_name = region_name or DEFAULT_REGION
    bedrock = _get_client(region_name)
    prompt = _build_prompt(transcript)

    text = ""
    try:
        response = bedrock.converse(
            modelId=model_id,
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
    except Exception:
        response = bedrock.invoke_model(
            modelId=model_id,
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

    return _parse_response(text)
