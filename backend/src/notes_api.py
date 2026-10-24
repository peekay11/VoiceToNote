import json
import os
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
NOTES_TABLE = os.environ.get("NOTES_TABLE")
table = dynamodb.Table(NOTES_TABLE)

def get_user_id(event):
    authorizer = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {})
    claims = authorizer.get("claims", {})
    return claims.get("sub") or claims.get("username") or "anonymous"

def response(status_code, body):
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
            # List notes for current user
            res = table.query(
                KeyConditionExpression=Key("userId").eq(user_id)
            )
            return response(200, res.get("Items", []))

        elif method == "GET" and note_id:
            # Get single note
            res = table.get_item(Key={"userId": user_id, "noteId": note_id})
            item = res.get("Item")
            if not item:
                return response(404, {"error": "Note not found"})
            return response(200, item)

        elif method == "PUT" and note_id:
            # Update note
            body = json.loads(event.get("body", "{}") or "{}")
            update_expression = []
            expression_attr_names = {}
            expression_attr_values = {}

            if "text" in body:
                update_expression.append("#t = :t")
                expression_attr_names["#t"] = "text"
                expression_attr_values[":t"] = body["text"]

            if "status" in body:
                update_expression.append("#s = :s")
                expression_attr_names["#s"] = "status"
                expression_attr_values[":s"] = body["status"]

            if not update_expression:
                return response(400, {"error": "No fields to update"})

            res = table.update_item(
                Key={"userId": user_id, "noteId": note_id},
                UpdateExpression="SET " + ", ".join(update_expression),
                ExpressionAttributeNames=expression_attr_names,
                ExpressionAttributeValues=expression_attr_values,
                ReturnValues="ALL_NEW",
            )
            return response(200, res.get("Attributes", {}))

        elif method == "DELETE" and note_id:
            table.delete_item(Key={"userId": user_id, "noteId": note_id})
            return response(200, {"message": "Note deleted"})

        return response(400, {"error": "Unsupported route or method"})
    except Exception as e:
        return response(500, {"error": str(e)})
