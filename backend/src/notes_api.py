import json
import os
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
bedrock = boto3.client("bedrock-runtime", region_name="af-south-1")

NOTES_TABLE = os.environ.get("NOTES_TABLE")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-micro-v1:0")

table = dynamodb.Table(NOTES_TABLE)


def get_user_id(event):
    authorizer = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {})
    claims = authorizer.get("claims", {})
    return claims.get("sub") or claims.get("username") or "anonymous"


def api_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def restructure_with_ai(text: str) -> dict:
    """Calls LLM to clean and re-derive all note fields from edited text."""
    prompt = f"""You are a voice note assistant. A user recorded a voice note and it was auto-transcribed. The transcription contains filler words, hesitations, and informal speech.

Raw transcript:
\"\"\"{text}\"\"\"

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

    raw = ""
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
        raw = response["output"]["message"]["content"][0]["text"].strip()
    except Exception:
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
                raw = result["content"][0].get("text", "").strip()
            elif "output" in result:
                raw = str(result.get("output", "")).strip()
            else:
                raw = str(result).strip()
        except Exception:
            raise

    if "```" in raw:
        parts = raw.split("```")
        for p in parts:
            p2 = p.strip()
            if p2.startswith("json"):
                p2 = p2[4:].strip()
            if p2.startswith("{") and p2.endswith("}"):
                raw = p2
                break
        else:
            if raw.startswith("```"):
                raw = parts[1] if len(parts) > 1 else raw
                if raw.strip().startswith("json"):
                    raw = raw.strip()[4:]
            raw = raw.strip()

    try:
        return json.loads(raw)
    except Exception:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(raw[start : end + 1])
        raise


def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "").upper()
    path_parameters = event.get("pathParameters") or {}
    note_id = path_parameters.get("id")
    user_id = get_user_id(event)

    try:
        if method == "GET" and not note_id:
            # List all notes for the current user
            res = table.query(KeyConditionExpression=Key("userId").eq(user_id))
            return api_response(200, res.get("Items", []))

        elif method == "GET" and note_id:
            # Get a single note by ID
            res = table.get_item(Key={"userId": user_id, "noteId": note_id})
            item = res.get("Item")
            if not item:
                return api_response(404, {"error": "Note not found"})
            return api_response(200, item)

        elif method == "PUT" and note_id:
            body = json.loads(event.get("body", "{}") or "{}")
            update_parts = []
            attr_names = {}
            attr_values = {}

            if "text" in body:
                new_text = body["text"]
                # Re-run AI structuring whenever the transcript is edited
                try:
                    structured = restructure_with_ai(new_text)
                    update_parts.append("#t = :t, #ti = :ti, #su = :su, #st = :st, #td = :td")
                    attr_names.update({"#t": "text", "#ti": "title", "#su": "summary", "#st": "status", "#td": "todos"})
                    attr_values.update({
                        ":t": structured.get("cleanedText", new_text),
                        ":ti": structured.get("title", "Voice Note"),
                        ":su": structured.get("summary", ""),
                        ":st": structured.get("status", "Planned"),
                        ":td": structured.get("todos", []),
                    })
                except Exception:
                    # AI failed — just update the raw text
                    update_parts.append("#t = :t")
                    attr_names["#t"] = "text"
                    attr_values[":t"] = new_text

            if "status" in body and "#st" not in attr_names:
                # Manual status toggle — only update status, don't overwrite AI status
                update_parts.append("#st = :st")
                attr_names["#st"] = "status"
                attr_values[":st"] = body["status"]

            if not update_parts:
                return api_response(400, {"error": "No fields to update"})

            res = table.update_item(
                Key={"userId": user_id, "noteId": note_id},
                UpdateExpression="SET " + ", ".join(update_parts),
                ExpressionAttributeNames=attr_names,
                ExpressionAttributeValues=attr_values,
                ReturnValues="ALL_NEW",
            )
            return api_response(200, res.get("Attributes", {}))

        elif method == "DELETE" and note_id:
            table.delete_item(Key={"userId": user_id, "noteId": note_id})
            return api_response(200, {"message": "Note deleted"})

        return api_response(400, {"error": "Unsupported route or method"})

    except Exception as e:
        return api_response(500, {"error": str(e)})
