const API_URL = import.meta.env.VITE_API_URL || "";

function getAuthHeader(): Record<string, string> {
  const auth = localStorage.getItem("voicetonote_auth");
  if (!auth) return {};
  try {
    const parsed = JSON.parse(auth);
    return parsed.idToken ? { Authorization: `Bearer ${parsed.idToken}` } : {};
  } catch {
    return {};
  }
}

export interface Note {
  noteId: string;
  userId: string;
  text: string;
  status: "Planned" | "Done";
  createdAt: string;
  updatedAt?: string;
  audioKey?: string;
}

export async function getUploadUrl(extension = "webm"): Promise<{ uploadUrl: string; noteId: string; key: string }> {
  if (!API_URL) {
    throw new Error("VITE_API_URL is not set in environment.");
  }

  const res = await fetch(`${API_URL}/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ extension }),
  });

  if (!res.ok) {
    throw new Error(`Failed to get presigned upload URL: ${res.statusText}`);
  }

  return res.json();
}

export async function uploadAudioToS3(uploadUrl: string, blob: Blob): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": blob.type || "audio/webm",
    },
    body: blob,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload audio to S3: ${res.statusText}`);
  }
}

export async function fetchNotes(): Promise<Note[]> {
  if (!API_URL) {
    return [];
  }

  const res = await fetch(`${API_URL}/notes`, {
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch notes: ${res.statusText}`);
  }

  return res.json();
}

export async function updateNote(id: string, updates: Partial<Note>): Promise<Note> {
  if (!API_URL) {
    throw new Error("VITE_API_URL not configured");
  }

  const res = await fetch(`${API_URL}/notes/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    throw new Error("Failed to update note");
  }

  return res.json();
}

export async function deleteNote(id: string): Promise<void> {
  if (!API_URL) return;

  const res = await fetch(`${API_URL}/notes/${id}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    throw new Error("Failed to delete note");
  }
}
