import { type NoteItem } from "../Components/NoteCard.tsx";

const CACHE_KEY = "voicetonote_notes";

export function getCachedNotes(): NoteItem[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as NoteItem[]) : [];
  } catch {
    return [];
  }
}

export function setCachedNotes(notes: NoteItem[]): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(notes));
}

export function updateCachedNote(noteId: string, changes: Partial<NoteItem>): void {
  const notes = getCachedNotes();
  const updated = notes.map((n) => (n.id === noteId ? { ...n, ...changes } : n));
  setCachedNotes(updated);
}

export function removeCachedNote(noteId: string): void {
  const notes = getCachedNotes();
  setCachedNotes(notes.filter((n) => n.id !== noteId));
}

export function clearNotesCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
