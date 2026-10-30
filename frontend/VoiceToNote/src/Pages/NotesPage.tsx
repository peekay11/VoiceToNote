
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../Components/SearchBar.tsx";
import VoiceRec from "../Components/VoiceRec.tsx";
import NoteCard, { type NoteItem } from "../Components/NoteCard.tsx";
import ProcessingCard from "../Components/ProcessingCard.tsx";
import ConfirmModal from "../Components/ConfirmModal.tsx";
import { deleteNote, fetchAndCacheNotes, updateNote } from "../services/api.ts";
import {
  getCachedNotes,
  removeCachedNote,
  updateCachedNote,
} from "../services/notesCache.ts";
import { useAuth } from "../context/AuthContext.tsx";
import { useTheme } from "../context/ThemeContext.tsx";
import {
  RiMoonLine,
  RiSunLine,
  RiLogoutBoxLine,
  RiDeleteBin6Line,
  RiTimeLine,
  RiCheckboxCircleLine,
  RiRefreshLine,
} from "react-icons/ri";
import "./NotesPage.css";

const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 90_000;

const NotesPage = () => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [initialLoading, setInitialLoading] = useState(true);

  const [pendingCardIds, setPendingCardIds] = useState<string[]>([]);

  const knownNoteIdsRef = useRef<Set<string>>(new Set());

  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartRef = useRef<number>(0);

  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();


  const refreshFromApi = useCallback(async () => {
    try {
      const freshNotes = await fetchAndCacheNotes();

      const newNotes = freshNotes.filter((n) => !knownNoteIdsRef.current.has(n.id));
      if (newNotes.length > 0) {
        setPendingCardIds((prev) => prev.slice(newNotes.length));
      }

      knownNoteIdsRef.current = new Set(freshNotes.map((n) => n.id));
      setNotes(freshNotes);
      return freshNotes;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const cached = getCachedNotes();
    if (cached.length > 0) {
      knownNoteIdsRef.current = new Set(cached.map((n) => n.id));
      setNotes(cached);
      setInitialLoading(false);
    }

    refreshFromApi().finally(() => setInitialLoading(false));
  }, [refreshFromApi]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);



  const schedulePoll = useCallback(
    (pendingCount: number) => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

      if (pendingCount === 0) return;
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT) {
        setPendingCardIds([]);
        return;
      }

      pollTimerRef.current = setTimeout(async () => {
        const fresh = await refreshFromApi();
        if (fresh !== null) {
          setPendingCardIds((prev) => {
            schedulePoll(prev.length);
            return prev;
          });
        } else {
          setPendingCardIds((prev) => {
            schedulePoll(prev.length);
            return prev;
          });
        }
      }, POLL_INTERVAL);
    },
    [refreshFromApi]
  );


  const PULL_THRESHOLD = 72;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartYRef.current = e.touches[0].clientY;
      isPullingRef.current = false;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartYRef.current === null || isRefreshing) return;
      const delta = e.touches[0].clientY - touchStartYRef.current;
      if (delta > 0) {
        isPullingRef.current = true;
        setPullDistance(Math.min(delta * 0.45, PULL_THRESHOLD + 20));
      }
    },
    [isRefreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    touchStartYRef.current = null;
    isPullingRef.current = false;

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(0);
      await refreshFromApi();
      setIsRefreshing(false);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshFromApi]);


  const handleDelete = async (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    setDeletingNoteId(noteId);
  };

  const confirmDelete = async () => {
    if (!deletingNoteId) return;
    try {
      await deleteNote(deletingNoteId);
      removeCachedNote(deletingNoteId);
      setNotes((prev) => prev.filter((n) => n.id !== deletingNoteId));
    } catch {
      alert("Failed to delete. Please try again.");
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleToggleTodo = async (noteId: string, index: number) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const todos = note.todos.map((todo, i) =>
      i === index ? { ...todo, done: !todo.done } : todo
    );
    const status: "Planned" | "Done" =
      todos.length > 0 && todos.every((todo) => todo.done) ? "Done" : "Planned";
    const changes = { todos, status };

    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, ...changes } : n)));
    updateCachedNote(noteId, changes);

    try {
      await updateNote(noteId, changes);
    } catch {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? note : n)));
      updateCachedNote(noteId, { todos: note.todos, status: note.status });
      alert("Failed to update task. Please try again.");
    }
  };

  const handleUploadSuccess = () => {
    setPendingCardIds((prev) => {
      const next = [...prev, `pending-${Date.now()}`];
      pollStartRef.current = Date.now();
      schedulePoll(next.length);
      return next;
    });
  };


  const filteredNotes = notes.filter((note) => {
    const query = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      note.context.toLowerCase().includes(query) ||
      note.status.toLowerCase().includes(query)
    );
  });

  const plannedNotes = filteredNotes.filter(
    (note) => note.status.toLowerCase() !== "done" && note.status.toLowerCase() !== "completed"
  );
  const doneNotes = filteredNotes.filter(
    (note) => note.status.toLowerCase() === "done" || note.status.toLowerCase() === "completed"
  );


  return (
    <div
      className="notes-page"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {deletingNoteId && (
        <ConfirmModal
          message="Delete this note? This cannot be undone."
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeletingNoteId(null)}
        />
      )}

      <div
        className="ptr-indicator"
        style={{
          transform: `translateY(${isRefreshing ? 48 : pullDistance}px)`,
          opacity: isRefreshing ? 1 : Math.min(pullDistance / 48, 1),
        }}
      >
        <RiRefreshLine
          size={20}
          className={isRefreshing ? "ptr-icon--spinning" : ""}
          style={{
            transform: isRefreshing
              ? undefined
              : `rotate(${Math.min((pullDistance / 72) * 180, 180)}deg)`,
          }}
        />
      </div>
      <header className="navbar">
        <div className="navbar-brand">
          <span className="brand-dot" />
          <span className="brand-name">VoiceToNote</span>
        </div>
        <div className="navbar-actions">
          <span className="navbar-user">{user?.email}</span>
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <RiSunLine size={18} /> : <RiMoonLine size={18} />}
          </button>
          <button className="icon-btn icon-btn--danger" onClick={logout} title="Sign out">
            <RiLogoutBoxLine size={18} />
          </button>
        </div>
      </header>

      <div className="toolbar">
        <SearchBar onSearch={setSearchQuery} />
      </div>

      <VoiceRec onUploadSuccess={handleUploadSuccess} />

      <main className="notes-main">
        {initialLoading && (
          <div className="loading-state">
            <span className="loading-spinner" />
            <p>Loading notes...</p>
          </div>
        )}

        {(plannedNotes.length > 0 || pendingCardIds.length > 0) && (
          <section className="notes-section">
            <h2 className="section-header section-header--planned">
              <RiTimeLine size={14} />
              Planned{" "}
              <span className="count-badge">{plannedNotes.length + pendingCardIds.length}</span>
            </h2>
            <div className="notes-grid">
              {pendingCardIds.map((id) => (
                <ProcessingCard key={id} />
              ))}
              {plannedNotes.map((note) => (
                <div key={note.id} className="note-card-wrapper">
                  <Link
                    to={`/note/${note.id}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
                  >
                    <NoteCard
                      note={note}
                      onToggleTodo={(index) => handleToggleTodo(note.id, index)}
                    />
                  </Link>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDelete(e, note.id)}
                    title="Delete note"
                  >
                    <RiDeleteBin6Line size={13} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {doneNotes.length > 0 && (
          <section className="notes-section">
            <h2 className="section-header section-header--done">
              <RiCheckboxCircleLine size={14} />
              Done <span className="count-badge count-badge--done">{doneNotes.length}</span>
            </h2>
            <div className="notes-grid">
              {doneNotes.map((note) => (
                <div key={note.id} className="note-card-wrapper">
                  <Link
                    to={`/note/${note.id}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
                  >
                    <NoteCard
                      note={note}
                      onToggleTodo={(index) => handleToggleTodo(note.id, index)}
                    />
                  </Link>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDelete(e, note.id)}
                    title="Delete note"
                  >
                    <RiDeleteBin6Line size={13} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!initialLoading && filteredNotes.length === 0 && pendingCardIds.length === 0 && (
          <div className="empty-state">
            <p>
              No notes yet. Press <strong>Rec</strong> to record your first voice note!
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default NotesPage;
