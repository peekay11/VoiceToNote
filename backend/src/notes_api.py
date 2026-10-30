import json
import os
import boto3
from boto3.dynamodb.conditions import Key

from ai_notes import structure_note_with_ai

dynamodb = boto3.resource("dynamodb")

NOTES_TABLE = os.environ.get("NOTES_TABLE")

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


def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "").upper()
    path_parameters = event.get("pathParameters") or {}
    note_id = path_parameters.get("id")
    user_id = get_user_id(event)

    try:
        if method == "GET" and not note_id:
            res = table.query(KeyConditionExpression=Key("userId").eq(user_id))
            return api_response(200, res.get("Items", []))

        elif method == "GET" and note_id:
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
                try:
                    structured = structure_note_with_ai(new_text)
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
                    update_parts.append("#t = :t")
                    attr_names["#t"] = "text"
                    attr_values[":t"] = new_text

            if "status" in body and "#st" not in attr_names:
                update_parts.append("#st = :st")
                attr_names["#st"] = "status"
                attr_values[":st"] = body["status"]

            if "todos" in body and "#td" not in attr_names:
                todos = []
                for todo in body["todos"] or []:
                    if isinstance(todo, str):
                        todos.append({"text": todo, "done": False})
                    elif isinstance(todo, dict):
                        todos.append({
                            "text": str(todo.get("text", "")),
                            "done": bool(todo.get("done", False)),
                        })
                update_parts.append("#td = :td")
                attr_names["#td"] = "todos"
                attr_values[":td"] = todos

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
