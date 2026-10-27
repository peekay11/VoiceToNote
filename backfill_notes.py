"""
One-time backfill script — runs locally using your AWS credentials.
Scans all notes in DynamoDB, calls Bedrock Claude Haiku on each one
to generate clean title, summary, cleanedText, status, and todos,
then updates the DynamoDB item.

Run: python3 backfill_notes.py
"""

import json
import boto3

REGION = "af-south-1"
TABLE_NAME = "voice-to-note-notes"
BEDROCK_MODEL_ID = "global.anthropic.claude-haiku-4-5-20251001-v1:0"

dynamodb = boto3.resource("dynamodb", region_name=REGION)
bedrock = boto3.client("bedrock-runtime", region_name=REGION)
table = dynamodb.Table(TABLE_NAME)


def structure_note_with_ai(transcript: str) -> dict:
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
    text = result["content"][0]["text"].strip()

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    return json.loads(text)


def backfill():
    print(f"Scanning table: {TABLE_NAME}\n")
    response = table.scan()
    items = response.get("Items", [])

    # Handle pagination
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))

    print(f"Found {len(items)} notes to process\n")

    for item in items:
        user_id = item["userId"]
        note_id = item["noteId"]
        raw_text = item.get("text", "")
        existing_title = item.get("title", "")

        # Skip notes that already have a proper AI-generated title
        if existing_title and existing_title != "Voice Note":
            print(f"  SKIP  {note_id[:8]}... — already has title: '{existing_title}'")
            continue

        print(f"  Processing {note_id[:8]}... — '{raw_text[:60]}...'")

        try:
            structured = structure_note_with_ai(raw_text)
            title = structured.get("title", "Voice Note")
            summary = structured.get("summary", "")
            cleaned_text = structured.get("cleanedText", raw_text)
            status = structured.get("status", item.get("status", "Planned"))
            todos = structured.get("todos", [])

            table.update_item(
                Key={"userId": user_id, "noteId": note_id},
                UpdateExpression="SET #ti = :ti, #su = :su, #t = :t, #rt = :rt, #st = :st, #td = :td",
                ExpressionAttributeNames={
                    "#ti": "title",
                    "#su": "summary",
                    "#t": "text",
                    "#rt": "rawText",
                    "#st": "status",
                    "#td": "todos",
                },
                ExpressionAttributeValues={
                    ":ti": title,
                    ":su": summary,
                    ":t": cleaned_text,
                    ":rt": raw_text,
                    ":st": status,
                    ":td": todos,
                },
            )
            print(f"    ✓ title='{title}' | status={status} | todos={len(todos)}")

        except Exception as e:
            print(f"    ✗ Failed: {e}")

    print("\nBackfill complete.")


if __name__ == "__main__":
    backfill()
