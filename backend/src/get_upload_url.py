import json
import os
import uuid
import boto3
from botocore.client import Config

# Explicitly configure the region and SigV4 to force correct regional URLs
s3_client = boto3.client(
    "s3",
    region_name=os.environ.get("AWS_REGION", "af-south-1"),
    config=Config(
        signature_version="s3v4",
        s3={'addressing_style': 'virtual'}
    )
)
AUDIO_BUCKET = os.environ.get("AUDIO_BUCKET")

def lambda_handler(event, context):
    try:
        # Extract authenticated user ID from JWT claims
        authorizer = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {})
        claims = authorizer.get("claims", {})
        user_id = claims.get("sub") or claims.get("username") or "anonymous"

        body = json.loads(event.get("body", "{}") or "{}")
        file_extension = body.get("extension", "webm")
        note_id = str(uuid.uuid4())
        s3_key = f"audio/{user_id}/{note_id}.{file_extension}"

        presigned_url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": AUDIO_BUCKET,
                "Key": s3_key,
                "ContentType": "audio/webm", # Hardcoded to match the frontend fix
            },
            ExpiresIn=300,
        )

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "uploadUrl": presigned_url,
                "noteId": note_id,
                "key": s3_key,
            }),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)}),
        }