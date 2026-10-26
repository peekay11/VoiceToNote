// Persists the user's notes list in localStorage so the app loads instantly on repeat visits.
// The cache is always written after a successful API fetch, and patched on edit/delete.
// Nothing in this file makes network calls — it's purely a read/write layer over localStorage.

import { type NoteItem } from "../Components/NoteCard.tsx";

const CACHE_KEY = "voicetonote_notes";

// ─── Read ─────────────────────────────────────────────────────────────────────

// Returns cached notes, or an empty array if nothing is stored yet
export function getCachedNotes(): NoteItem[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as NoteItem[]) : [];
  } catch {
    return [];
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

// Replaces the entire cache with a fresh list from the API
export function setCachedNotes(notes: NoteItem[]): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(notes));
}

// Updates a single note in the cache without re-fetching the full list
export function updateCachedNote(noteId: string, changes: Partial<NoteItem>): void {
  const notes = getCachedNotes();
  const updated = notes.map((n) => (n.id === noteId ? { ...n, ...changes } : n));
  setCachedNotes(updated);
}

// Removes a single note from the cache after it's deleted on the API
export function removeCachedNote(noteId: string): void {
  const notes = getCachedNotes();
  setCachedNotes(notes.filter((n) => n.id !== noteId));
}

// Clears the entire cache (e.g. on logout so another user's notes don't leak)
export function clearNotesCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
