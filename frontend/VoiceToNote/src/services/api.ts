import { refreshSession } from "./cognitoAuth.ts";
import { setCachedNotes } from "./notesCache.ts";
import { type NoteItem, type TodoItem } from "../Components/NoteCard.tsx";

const API_URL = import.meta.env.VITE_API_URL || "";
const AUTH_STORAGE_KEY = "voicetonote_auth";

export interface Note {
  noteId: string;
  userId: string;
  text: string;
  title?: string;
  summary?: string;
  todos?: Array<string | TodoItem>;
  status: "Planned" | "Done";
  createdAt: string;
  updatedAt?: string;
  audioKey?: string;
}

function getStoredAuth(): { idToken: string; refreshToken: string } | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildAuthHeader(): Record<string, string> {
  const auth = getStoredAuth();
  return auth?.idToken ? { Authorization: `Bearer ${auth.idToken}` } : {};
}

async function tryRefreshToken(): Promise<string | null> {
  const auth = getStoredAuth();
  if (!auth?.refreshToken) return null;

  try {
    const newTokens = await refreshSession(auth.refreshToken);
    const updatedAuth = { ...auth, ...newTokens };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedAuth));

    // Notify AuthContext in the same tab.
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: AUTH_STORAGE_KEY,
        newValue: JSON.stringify(updatedAuth),
      })
    );

    return newTokens.idToken;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("auth:logout"));
    return null;
  }
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...buildAuthHeader(),
      ...(options.headers as Record<string, string>),
    },
  });

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

export async function fetchNotes(): Promise<Note[]> {
  if (!API_URL) return [];

  const response = await apiFetch(`${API_URL}/notes`);

  if (!response.ok) {
    throw new Error(`Failed to fetch notes: ${response.statusText}`);
  }

  return response.json();
}

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

export async function deleteNote(noteId: string): Promise<void> {
  if (!API_URL) return;

  const response = await apiFetch(`${API_URL}/notes/${noteId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete note: ${response.statusText}`);
  }
}

function fallbackTitle(text: string): string {
  const cleaned = (text || "").trim();
  if (!cleaned) return "Voice Note";
  const match = cleaned.search(/[.!?]/);
  const first = match !== -1 ? cleaned.slice(0, match) : cleaned;
  const words = first.trim().split(/\s+/);
  return words.length > 6 ? words.slice(0, 6).join(" ") + "..." : words.join(" ") || "Voice Note";
}

export function apiNoteToNoteItem(apiNote: Note): NoteItem {
  const title = apiNote.title || fallbackTitle(apiNote.text || "");
  const summary = typeof apiNote.summary === "string" ? apiNote.summary.trim() : "";
  const context = summary || (apiNote.text || "");

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

export async function fetchAndCacheNotes(): Promise<NoteItem[]> {
  const apiNotes = await fetchNotes();
  const noteItems = apiNotes.map(apiNoteToNoteItem);
  setCachedNotes(noteItems);
  return noteItems;
}
