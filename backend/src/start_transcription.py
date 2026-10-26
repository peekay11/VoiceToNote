import urllib.parse
import boto3

# Transcribe is not available in af-south-1, route to us-east-1
transcribe_client = boto3.client("transcribe", region_name="us-east-1")

def lambda_handler(event, context):
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

        # Format: audio/<userId>/<noteId>.<ext>
        parts = key.split("/")
        if len(parts) < 3:
            continue

        filename = parts[-1]
        note_id = filename.rsplit(".", 1)[0]
        user_id = parts[1]

        job_name = f"VoiceNote_{user_id}_{note_id}"
        file_uri = f"s3://{bucket}/{key}"
        ext = filename.rsplit(".", 1)[-1].lower()
        media_format = "webm" if ext == "webm" else ("mp3" if ext == "mp3" else "wav")

        transcribe_client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": file_uri},
            MediaFormat=media_format,
            LanguageCode="en-US",
            # OutputBucketName intentionally omitted — Transcribe stores output
            # in a service-managed bucket in us-east-1. We fetch the result URL
            # via GetTranscriptionJob in process_transcript.py.
            Tags=[
                {"Key": "UserId", "Value": user_id},
                {"Key": "NoteId", "Value": note_id},
            ],
        )

    return {"statusCode": 200, "body": "Transcription started"}
