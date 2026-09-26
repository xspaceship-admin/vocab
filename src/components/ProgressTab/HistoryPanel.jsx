import { useEffect } from 'react';
import { XIcon } from '../../icons.jsx';

export default function HistoryPanel({ history, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="history-backdrop" onClick={onClose} />
      <aside className="history-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>History</h2>
          <button className="defs-icon-btn" onClick={onClose} title="Close" style={{ width: 28, height: 28 }}>
            <XIcon />
          </button>
        </div>
        {history.length ? (
          history.map((h, i) => (
            <div className="history-item" key={i}>
              <span>
                {h.article.title}{' '}
                <span className="date">({h.article.topic})</span>
              </span>
              <span className="date" style={{ flexShrink: 0, marginLeft: 12 }}>
                {h.date} · {h.results ? `${h.results.score}/${h.results.total}` : 'Not completed'}
              </span>
            </div>
          ))
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>No completed quizzes yet.</p>
        )}
      </aside>
    </>
  );
}
