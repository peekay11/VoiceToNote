import json
import os
import datetime
import urllib.request
import boto3

from ai_notes import structure_note_with_ai

dynamodb = boto3.resource("dynamodb")

NOTES_TABLE = os.environ.get("NOTES_TABLE")
TRANSCRIBE_REGION = os.environ.get("TRANSCRIBE_REGION", "af-south-1")

transcribe_client = boto3.client("transcribe", region_name=TRANSCRIBE_REGION)


def lambda_handler(event, context):
    detail = event.get("detail", {})
    job_name = detail.get("TranscriptionJobName", "")

    parts = job_name.split("_", 2)
    if len(parts) < 3:
        return {"statusCode": 400, "body": "Invalid job name"}

    user_id = parts[1]
    note_id = parts[2]

    job = transcribe_client.get_transcription_job(TranscriptionJobName=job_name)
    job_detail = job["TranscriptionJob"]
    transcript_uri = job_detail["Transcript"]["TranscriptFileUri"]

    media_uri = job_detail.get("Media", {}).get("MediaFileUri", "")
    audio_ext = media_uri.rsplit(".", 1)[-1] if "." in media_uri else "webm"

    with urllib.request.urlopen(transcript_uri) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    transcripts = body.get("results", {}).get("transcripts", [])
    raw_text = transcripts[0].get("transcript", "") if transcripts else ""

    try:
        structured = structure_note_with_ai(raw_text)
        title = structured.get("title", "Voice Note")
        summary = structured.get("summary", "")
        cleaned_text = structured.get("cleanedText", raw_text)
        status = structured.get("status", "Planned")
        todos = structured.get("todos", [])
    except Exception as ai_error:
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
