import json
import os
import datetime
import boto3

s3_client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
NOTES_TABLE = os.environ.get("NOTES_TABLE")

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
    parts = job_name.split("_")
    if len(parts) < 3:
        return {"statusCode": 400, "body": "Invalid job name"}

    user_id = parts[1]
    note_id = parts[2]

    # Read transcript from S3
    bucket = os.environ.get("AUDIO_BUCKET")
    transcript_key = f"transcripts/{user_id}/{note_id}.json"

    obj = s3_client.get_object(Bucket=bucket, Key=transcript_key)
    body = json.loads(obj["Body"].read().decode("utf-8"))

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
        "audioKey": f"audio/{user_id}/{note_id}.webm",
    }
    table.put_item(Item=item)

    return {"statusCode": 200, "body": json.dumps({"noteId": note_id, "status": status})}
