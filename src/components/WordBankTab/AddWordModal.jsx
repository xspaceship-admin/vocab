import { useEffect, useRef, useState } from 'react';
import { useFavorites } from '../../context/FavoritesContext.jsx';
import { XIcon } from '../../icons.jsx';

export default function AddWordModal({ open, onClose, onAdded }) {
  const { addFavorite } = useFavorites();
  const [term, setTerm] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMsg(null);
      setTerm('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    const value = term.trim();
    if (!value) return;
    setBusy(true);
    setMsg({ text: 'Looking that up…', color: 'var(--muted)' });
    try {
      const res = await addFavorite(value);
      setMsg({
        text: res.alreadyExists ? `“${res.favorite.term}” is already on your list.` : `Added “${res.favorite.term}”!`,
        color: res.alreadyExists ? 'var(--muted)' : 'var(--good)',
      });
      setTerm('');
      onAdded?.(res.favorite);
    } catch (err) {
      setMsg({ text: err.message, color: 'var(--bad)' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box">
        <div className="row" style={{ marginTop: 0, alignItems: 'flex-start' }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Add a word or phrase</h2>
          <button className="defs-icon-btn" title="Close" onClick={onClose}>
            <XIcon />
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -6 }}>
          We'll look up a definition and example, and start weaving it into your daily news.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            ref={inputRef}
            className="fill-input"
            placeholder="e.g. “bite the bullet”"
            style={{ flex: 1, fontSize: 16, padding: '12px 14px', borderRadius: 0, border: '1px solid var(--ink)' }}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          <button className="btn" disabled={busy} onClick={submit}>
            Add
          </button>
        </div>
        {msg && (
          <div style={{ fontSize: 12, marginTop: 10, color: msg.color }}>{msg.text}</div>
        )}
      </div>
    </div>
  );
}
