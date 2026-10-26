// All API calls to the VoiceToNote backend (API Gateway + Lambda).
// Every request is authenticated with the user's Cognito ID token (Bearer header).
// If a request gets a 401, we automatically refresh the token and retry once.

import { refreshSession } from "./cognitoAuth.ts";
import { setCachedNotes } from "./notesCache.ts";
import { type NoteItem, type TodoItem } from "../Components/NoteCard.tsx";

const API_URL = import.meta.env.VITE_API_URL || "";
const AUTH_STORAGE_KEY = "voicetonote_auth";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Note {
  noteId: string;
  userId: string;
  text: string;
  title?: string;    // AI-generated topic title
  summary?: string;  // AI-generated one-line summary
  todos?: string[];  // AI-extracted action items
  status: "Planned" | "Done";
  createdAt: string;
  updatedAt?: string;
  audioKey?: string;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

// Reads the stored auth object from localStorage
function getStoredAuth(): { idToken: string; refreshToken: string } | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Builds the Authorization header using the stored id token
function buildAuthHeader(): Record<string, string> {
  const auth = getStoredAuth();
  return auth?.idToken ? { Authorization: `Bearer ${auth.idToken}` } : {};
}

// Tries to get new tokens using the refresh token.
// On failure, clears the session and fires an event so AuthContext can redirect to /login.
async function tryRefreshToken(): Promise<string | null> {
  const auth = getStoredAuth();
  if (!auth?.refreshToken) return null;

  try {
    const newTokens = await refreshSession(auth.refreshToken);
    const updatedAuth = { ...auth, ...newTokens };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedAuth));

    // Tell AuthContext about the new tokens (same-tab workaround for storage events)
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: AUTH_STORAGE_KEY,
        newValue: JSON.stringify(updatedAuth),
      })
    );

    return newTokens.idToken;
  } catch {
    // Refresh token is expired — log the user out
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("auth:logout"));
    return null;
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

// Wraps fetch with automatic token refresh on 401. Retries the request once.
async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...buildAuthHeader(),
      ...(options.headers as Record<string, string>),
    },
  });

  // Token expired — try to refresh and retry the original request
  if (response.status === 401) {
    const newIdToken = await tryRefreshToken();
    if (newIdToken) {
      return fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${newIdToken}`,
          ...(options.headers as Record<string, string>),
        },
      });
    }
  }

  return response;
}

// ─── API functions ────────────────────────────────────────────────────────────

// Gets a short-lived S3 presigned URL so the client can upload audio directly.
export async function getUploadUrl(
  extension = "webm"
): Promise<{ uploadUrl: string; noteId: string; key: string }> {
  if (!API_URL) throw new Error("VITE_API_URL is not set in .env");

  const response = await apiFetch(`${API_URL}/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extension }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get upload URL: ${response.statusText}`);
  }

  return response.json();
}

// Uploads audio directly to S3 using the presigned URL. No auth header needed here.
export async function uploadAudioToS3(uploadUrl: string, audioBlob: Blob): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "audio/webm" },
    body: audioBlob,
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.statusText}`);
  }
}

// Fetches all notes for the logged-in user.
export async function fetchNotes(): Promise<Note[]> {
  if (!API_URL) return [];

  const response = await apiFetch(`${API_URL}/notes`);

  if (!response.ok) {
    throw new Error(`Failed to fetch notes: ${response.statusText}`);
  }

  return response.json();
}

// Updates specific fields on a note (e.g. text or status).
export async function updateNote(noteId: string, changes: Partial<Note>): Promise<Note> {
  if (!API_URL) throw new Error("VITE_API_URL is not set in .env");

  const response = await apiFetch(`${API_URL}/notes/${noteId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });

  if (!response.ok) {
    throw new Error(`Failed to update note: ${response.statusText}`);
  }

  return response.json();
}

// Permanently deletes a note by ID.
export async function deleteNote(noteId: string): Promise<void> {
  if (!API_URL) return;

  const response = await apiFetch(`${API_URL}/notes/${noteId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete note: ${response.statusText}`);
  }
}

// ─── Cache helper ─────────────────────────────────────────────────────────────

// Fallback: derives a title from the transcript if the API item predates the title field
function fallbackTitle(text: string): string {
  const cleaned = (text || "").trim();
  if (!cleaned) return "Voice Note";
  const match = cleaned.search(/[.!?]/);
  const first = match !== -1 ? cleaned.slice(0, match) : cleaned;
  const words = first.trim().split(/\s+/);
  return words.length > 6 ? words.slice(0, 6).join(" ") + "..." : words.join(" ") || "Voice Note";
}

// Converts a raw API note to the NoteItem shape used by the UI.
// Uses stored title/summary/todos if present (new notes), falls back to derivation for old notes.
export function apiNoteToNoteItem(apiNote: Note): NoteItem {
  const title = apiNote.title || fallbackTitle(apiNote.text);
  const context = apiNote.summary ?? (apiNote.text || "");

  // API stores todos as plain strings — convert to TodoItem objects for the UI
  const todos: TodoItem[] = (apiNote.todos || []).map((t) => ({
    text: typeof t === "string" ? t : (t as TodoItem).text,
    done: typeof t === "string" ? false : (t as TodoItem).done ?? false,
  }));

  return {
    id: apiNote.noteId,
    title,
    status: apiNote.status || "Planned",
    todos,
    context,
    createdAt: apiNote.createdAt,
  };
}

// Fetches notes from the API and writes the result to the local cache.
// Returns the transformed NoteItem list so the caller can update state directly.
export async function fetchAndCacheNotes(): Promise<NoteItem[]> {
  const apiNotes = await fetchNotes();
  const noteItems = apiNotes.map(apiNoteToNoteItem);
  setCachedNotes(noteItems);
  return noteItems;
}
