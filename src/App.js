import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import {
  collection, addDoc, getDocs, updateDoc,
  deleteDoc, doc, orderBy, query
} from "firebase/firestore";
import "./App.css";

const COLORS      = ["c0","c1","c2","c3","c4","c5","c6","c7"];
const PINS        = ["📌","🔴","🟠","🟡","🟢","🔵"];
const TAPE_COLORS = ["#ffaaaa","#aaccff","#aaffcc","#ffccaa","#ccaaff","#ffffaa"];
const DECORS      = ["pin","tape","tape-color","clip","pin","tape","clip","tape-color"];

const NOTE_W = 185;
const NOTE_H = 175;
const TOPBAR = 64;
const PAD    = 24;

function seededRand(seed, min, max) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return min + ((h >>> 0) % 1000) / 1000 * (max - min);
}

/** Place notes in a flowing grid that wraps based on board width */
function initialPosition(id, index, boardW) {
  const cols   = Math.max(1, Math.floor((boardW - PAD) / (NOTE_W + PAD)));
  const col    = index % cols;
  const row    = Math.floor(index / cols);
  const jx     = seededRand(id + "x", -18, 18);
  const jy     = seededRand(id + "y", -14, 14);
  return {
    x: PAD + col * (NOTE_W + PAD) + jx,
    y: PAD + row * (NOTE_H + PAD + 20) + jy,
  };
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─────────────────────────────────────────────────────────── */
function StickyNote({ note, index, pos, rotation, onEdit, onDelete, onDragEnd }) {
  const [editing,  setEditing]  = useState(false);
  const [text,     setText]     = useState(note.text);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState(pos);
  const dragRef  = useRef(null);
  const stickyRef = useRef(null);

  // Keep position in sync if parent changes it (e.g. on first load)
  useEffect(() => { setPosition(pos); }, [pos.x, pos.y]);

  const color  = COLORS[index % COLORS.length];
  const decor  = DECORS[index % DECORS.length];
  const pin    = PINS[index % PINS.length];
  const tapeC  = TAPE_COLORS[index % TAPE_COLORS.length];

  // ── DRAG ──────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (editing) return;
    if (e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    setDragging(true);

    const onMove = (me) => {
      const newX = me.clientX - startX;
      const newY = me.clientY - startY;
      setPosition({ x: newX, y: newY });
    };

    const onUp = (me) => {
      const finalX = me.clientX - startX;
      const finalY = me.clientY - startY;
      setDragging(false);
      setPosition({ x: finalX, y: finalY });
      onDragEnd(note.id, { x: finalX, y: finalY });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [editing, position, note.id, onDragEnd]);

  // Touch support
  const onTouchStart = useCallback((e) => {
    if (editing) return;
    const touch  = e.touches[0];
    const startX = touch.clientX - position.x;
    const startY = touch.clientY - position.y;

    setDragging(true);

    const onMove = (te) => {
      const t = te.touches[0];
      setPosition({ x: t.clientX - startX, y: t.clientY - startY });
    };

    const onEnd = (te) => {
      const t = te.changedTouches[0];
      const fx = t.clientX - startX;
      const fy = t.clientY - startY;
      setDragging(false);
      setPosition({ x: fx, y: fy });
      onDragEnd(note.id, { x: fx, y: fy });
      window.removeEventListener("touchmove",  onMove);
      window.removeEventListener("touchend",   onEnd);
    };

    window.addEventListener("touchmove",  onMove, { passive: true });
    window.addEventListener("touchend",   onEnd);
  }, [editing, position, note.id, onDragEnd]);

  const handleSave = () => {
    if (!text.trim()) return;
    onEdit(note.id, text);
    setEditing(false);
  };

  const handleCancel = () => {
    setText(note.text);
    setEditing(false);
  };

  return (
    <div
      ref={stickyRef}
      className={`sticky ${color} ${dragging ? "dragging" : ""}`}
      style={{
        left:      position.x,
        top:       position.y,
        transform: dragging ? `rotate(3deg) scale(1.06)` : `rotate(${rotation}deg)`,
        zIndex:    dragging ? 9999 : index + 1,
        animationDelay: `${index * 0.055}s`,
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {decor === "pin"        && <span className="pin">{pin}</span>}
      {decor === "tape"       && <span className="tape" />}
      {decor === "tape-color" && <span className="tape-color" style={{ background: tapeC }} />}
      {decor === "clip"       && <span className="clip">📎</span>}

      <div className="sticky-actions">
        <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setEditing(true)}>✏️</button>
        <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onDelete(note.id)}>🗑️</button>
      </div>

      {editing ? (
        <div className="sticky-edit" onMouseDown={(e) => e.stopPropagation()}>
          <textarea
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
              if (e.key === "Escape") handleCancel();
            }}
          />
          <div className="edit-btns">
            <button className="btn-discard" onClick={handleCancel}>Cancel</button>
            <button className="btn-confirm" onClick={handleSave}>Done</button>
          </div>
        </div>
      ) : (
        <p className="sticky-text">{note.text}</p>
      )}

      <span className="sticky-date">{formatDate(note.createdAt)}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
export default function App() {
  const [noteText,   setNoteText]   = useState("");
  const [notes,      setNotes]      = useState([]);
  const [positions,  setPositions]  = useState({});   // { [id]: {x,y} }
  const [loading,    setLoading]    = useState(false);
  const boardRef = useRef(null);
  const [boardW, setBoardW] = useState(window.innerWidth);

  useEffect(() => {
    const obs = new ResizeObserver(([e]) => setBoardW(e.contentRect.width));
    if (boardRef.current) obs.observe(boardRef.current);
    return () => obs.disconnect();
  }, []);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const q    = query(collection(db, "notes"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNotes(fetched);

      // Assign initial positions only for notes that don't have one yet
      setPositions((prev) => {
        const next = { ...prev };
        fetched.forEach((n, i) => {
          if (!next[n.id]) {
            // Use saved position from Firestore if present
            if (n.posX !== undefined && n.posY !== undefined) {
              next[n.id] = { x: n.posX, y: n.posY };
            } else {
              next[n.id] = initialPosition(n.id, i, boardW);
            }
          }
        });
        return next;
      });
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [boardW]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // CREATE
  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      const newPos = initialPosition("new" + Date.now(), notes.length, boardW);
      await addDoc(collection(db, "notes"), {
        text: noteText,
        createdAt: new Date(),
        posX: newPos.x,
        posY: newPos.y,
      });
      setNoteText("");
      fetchNotes();
    } catch { alert("Couldn't save note."); }
  };

  // UPDATE text
  const editNote = async (id, newText) => {
    try {
      await updateDoc(doc(db, "notes", id), { text: newText });
      setNotes((prev) => prev.map((n) => n.id === id ? { ...n, text: newText } : n));
    } catch { alert("Couldn't update note."); }
  };

  // DELETE
  const deleteNote = async (id) => {
    if (!window.confirm("Toss this note?")) return;
    try {
      await deleteDoc(doc(db, "notes", id));
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setPositions((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } catch { alert("Couldn't delete note."); }
  };

  // DRAG END — persist position
  const handleDragEnd = useCallback(async (id, newPos) => {
    setPositions((prev) => ({ ...prev, [id]: newPos }));
    try {
      await updateDoc(doc(db, "notes", id), { posX: newPos.x, posY: newPos.y });
    } catch { /* non-critical */ }
  }, []);

  // Canvas height = tallest note bottom + padding
  const canvasH = Math.max(
    window.innerHeight - TOPBAR,
    ...Object.values(positions).map((p) => p.y + NOTE_H + 60)
  );

  return (
    <>
      {/* ── TOP BAR ── */}
      <div className="topbar">
        <div className="topbar-left">
          <h1>📋 My Board</h1>
          <p>drag · drop · remember</p>
        </div>
        <div className="topbar-right">
          <div className="add-form">
            <input
              type="text"
              placeholder="Write a note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
            />
            <button onClick={addNote}>+ Add</button>
          </div>
          <span className="count-badge">{notes.length} notes</span>
        </div>
      </div>

      {/* ── BOARD ── */}
      <div className="board" ref={boardRef}>
        <div className="board-canvas" style={{ height: canvasH }}>
          {!loading && notes.length === 0 && (
            <div className="empty-state">
              <p>📝 Nothing here yet…<br />Add your first note above!</p>
            </div>
          )}
          {notes.map((n, i) => {
            const pos = positions[n.id] || initialPosition(n.id, i, boardW);
            const rot = seededRand(n.id + "r", -6, 6);
            return (
              <StickyNote
                key={n.id}
                note={n}
                index={i}
                pos={pos}
                rotation={rot}
                onEdit={editNote}
                onDelete={deleteNote}
                onDragEnd={handleDragEnd}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}