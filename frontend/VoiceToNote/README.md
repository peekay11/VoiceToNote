# VoiceToNote Frontend

The web client for VoiceToNote. Built with React 19, TypeScript and Vite. It
records audio in the browser, uploads it to the backend, and displays notes
organised into Planned and Done.

For the full project overview, architecture and backend setup, see the
[main README](../../Readme.md).

## Requirements

- Node.js 20 or newer
- A deployed VoiceToNote backend (see the main README)

## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file in this folder and fill in the values from the backend
deployment outputs:

```env
VITE_API_URL="https://your-api-id.execute-api.af-south-1.amazonaws.com"
VITE_COGNITO_CLIENT_ID="your-user-pool-client-id"
VITE_AWS_REGION=af-south-1
VITE_COGNITO_USER_POOL_ID="your-user-pool-id"
```

Use the API URL exactly as printed, with no trailing slash.

## Run

```bash
npm run dev
```

Open `http://localhost:5173`. The microphone only works on `localhost` or over
HTTPS.

## Scripts

```bash
npm run dev       # start the development server
npm run build     # type-check and build for production (output in dist/)
npm run preview   # preview the production build
npm run lint      # run oxlint
npm test          # run tests with Vitest
```

## Structure

```
src/
  Pages/
    LoginPage.tsx      sign in
    SignupPage.tsx     create account and confirm email
    NotesPage.tsx      notes board, recording, polling, search
    NotesDetail.tsx    note detail, editing, tasks, status, delete
  Components/
    VoiceRec.tsx       microphone recording and upload
    NoteCard.tsx       note card with task checkboxes
    ProcessingCard.tsx placeholder shown while a note is processed
    SearchBar.tsx      search input
    ConfirmModal.tsx   confirmation dialog
    ProtectedRoute.tsx redirects signed-out users to login
  context/
    AuthContext.tsx    authentication state and token refresh
    ThemeContext.tsx   light and dark theme
  services/
    cognitoAuth.ts     Cognito sign up, sign in and refresh calls
    api.ts             API requests with automatic token refresh
    notesCache.ts      localStorage cache for notes
  App.tsx              routes and providers
  main.tsx             entry point
```

## Notes

- Authentication tokens are stored in `localStorage` and refreshed
  automatically when they expire.
- Notes are cached in `localStorage` so the list appears immediately on load and
  while the app fetches fresh data from the API.
- Audio is recorded as `audio/webm` and uploaded directly to Amazon S3 using a
  presigned URL from the backend.
