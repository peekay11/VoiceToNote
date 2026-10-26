import json
import os
import datetime
import urllib.request
import boto3

s3_client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
NOTES_TABLE = os.environ.get("NOTES_TABLE")

# Transcribe events arrive via EventBridge regardless of region
transcribe_client = boto3.client("transcribe", region_name="us-east-1")

def classify_note(text: str) -> str:
    lower_text = text.lower()
    # Check if phrase represents a plan vs completed task
    if any(phrase in lower_text for phrase in ["i did", "finished", "completed", "i have done", "done with"]):
        return "Done"
    return "Planned"

def lambda_handler(event, context):
    detail = event.get("detail", {})
    job_name = detail.get("TranscriptionJobName", "")

    # Job name format: VoiceNote_<userId>_<noteId>
    # userId and noteId are UUIDs (hyphens only), so splitting on _ is safe,
    # but use maxsplit=2 to be defensive.
    parts = job_name.split("_", 2)
    if len(parts) < 3:
        return {"statusCode": 400, "body": "Invalid job name"}

    user_id = parts[1]
    note_id = parts[2]

    # Fetch the transcript URI from Transcribe (service-managed bucket, us-east-1)
    job = transcribe_client.get_transcription_job(TranscriptionJobName=job_name)
    job_detail = job["TranscriptionJob"]
    transcript_uri = job_detail["Transcript"]["TranscriptFileUri"]

    # Derive the actual audio extension from the original media URI
    media_uri = job_detail.get("Media", {}).get("MediaFileUri", "")
    audio_ext = media_uri.rsplit(".", 1)[-1] if "." in media_uri else "webm"

    with urllib.request.urlopen(transcript_uri) as response:
        body = json.loads(response.read().decode("utf-8"))

    results = body.get("results", {})
    transcripts = results.get("transcripts", [])
    raw_text = transcripts[0].get("transcript", "") if transcripts else ""

    status = classify_note(raw_text)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    table = dynamodb.Table(NOTES_TABLE)
    item = {
        "userId": user_id,
        "noteId": note_id,
        "text": raw_text,
        "status": status,
        "createdAt": now,
        "updatedAt": now,
        "audioKey": f"audio/{user_id}/{note_id}.{audio_ext}",
    }
    table.put_item(Item=item)

    return {"statusCode": 200, "body": json.dumps({"noteId": note_id, "status": status})}
