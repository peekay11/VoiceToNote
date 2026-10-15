WTC-LXSJVS27

# Welcome to the VoiceToNote repo 

Speak a quick note and let the cloud organize it for you. Say **"I'm planning to..."** and it lands in your *Planned* list. Say **"I did..."** and it goes to *Done*, automatically ticking off the matching plan.

## Technologies Used

**Frontend**
- **React** (with Vite): UI for recording and viewing notes
- **MediaRecorder API**: in-browser voice recording
- CSS for styling

**Cloud (AWS, fully serverless)**
- **Amazon S3**: stores audio recordings and transcripts
- **AWS Lambda**: runs the backend logic (Python 3.12)
- **Amazon Transcribe**: converts speech to text
- **Amazon EventBridge**: triggers processing when transcription finishes
- **Amazon DynamoDB**: stores notes
- **Amazon API Gateway**: exposes the REST API

**Tooling**
- **AWS SAM**: infrastructure as code and deployment
- **Python (boto3)**: Lambda functions

## How It Works

1. The React app records audio and uploads it to S3 via a presigned URL.
2. An S3 event triggers Lambda to start a Transcribe job.
3. When the job completes, EventBridge triggers a second Lambda.
4. The note is classified as a plan or done, matched to open plans, and saved to DynamoDB.
5. The app polls the API and shows your **Planned** and **Done** columns.

## Getting Started

### 1. Deploy the backend

```bash
sam build
sam deploy --guided
```

Copy the `ApiUrl` from the deploy output.

### 2. Run the React frontend

```bash
cd frontend
npm install
```

Create `frontend/.env` and add your API URL (no trailing slash):

```
VITE_API_URL=https://your-api-id.execute-api.your-region.amazonaws.com/Prod
```

Then start the dev server:

```bash
npm run dev
```

Open `http://localhost:5173` and start talking. (The microphone only works on `localhost` or HTTPS.)

## Cleanup

```bash
aws s3 rm s3://voice-notes-<ACCOUNT_ID>-<REGION> --recursive
sam delete
```