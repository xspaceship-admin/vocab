import { useState } from 'react';
import { useFavorites } from '../context/FavoritesContext.jsx';
import { api } from '../api.js';
import { XIcon, StarFilledIcon } from '../icons.jsx';
import PhoneticRow from './PhoneticRow.jsx';

function termAppearsInBody(body, term) {
  if (!body) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return new RegExp(`\\b${escaped}\\b`, 'i').test(body);
  } catch {
    return body.toLowerCase().includes(term.toLowerCase());
  }
}

// Side panel listing every highlighted word in an article: the day's quiz
// words (real meaning hidden until answered, when `locked`) plus any
// favorited term that actually appears in the body (favorites always show
// their real definition, since that's already known/saved).
export default function DefsPanel({ body, targetWords = [], locked = false, interactive = false, onSkipWord, onStartQuiz }) {
  const { favorites, removeFavorite } = useFavorites();
  const [lookedUp, setLookedUp] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  const targetLower = new Set(targetWords.map((w) => w.term.toLowerCase()));
  const favTerms = favorites.filter(
    (f) => !targetLower.has(f.term.toLowerCase()) && termAppearsInBody(body, f.term)
  );

  // Today's panel always renders (even empty) since it also hosts the "Start
  // quiz" button; Archive's read-only panel just omits itself when empty.
  if (!interactive && !targetWords.length && !favTerms.length) return null;

  const lookupDefinition = async (word) => {
    setLoadingId(word.wordId);
    try {
      const res = await api('/api/define', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ term: word.term }),
      });
      setLookedUp((prev) => ({ ...prev, [word.wordId]: res.definition }));
    } finally {
      setLoadingId(null);
    }
  };

  const hasRows = targetWords.length > 0 || favTerms.length > 0;

  return (
    <aside className="defs-panel">
      {interactive && (
        <div className="defs-panel-header">
          <button className="nav-btn defs-panel-quiz-btn" onClick={onStartQuiz}>
            Quiz →
          </button>
        </div>
      )}
      <div className="defs-list">
        {targetWords.map((w) => {
          const definition = w.definition || lookedUp[w.wordId];
          return (
            <div className="defs-row" key={w.wordId}>
              <div className="defs-row-head">
                <span className="defs-term">{w.term}</span>
                {onSkipWord && (
                  <button
                    className="defs-icon-btn"
                    title={interactive ? 'I already know this — remove from quiz' : 'Remove highlight'}
                    onClick={() => onSkipWord(w.wordId)}
                  >
                    <XIcon />
                  </button>
                )}
              </div>
              <PhoneticRow term={w.term} />
              {!locked && (
                <div className="defs-meaning">
                  {definition ? (
                    definition
                  ) : (
                    <button className="defs-action" disabled={loadingId === w.wordId} onClick={() => lookupDefinition(w)}>
                      {loadingId === w.wordId ? 'Loading…' : 'Show definition'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {favTerms.map((f) => (
          <div className="defs-row" key={f.id}>
            <div className="defs-row-head">
              <span className="defs-term">{f.term}</span>
              <button className="defs-icon-btn" title="Unfavorite" onClick={() => removeFavorite(f.id)}>
                <StarFilledIcon />
              </button>
            </div>
            <PhoneticRow term={f.term} />
            <div className="defs-meaning">{f.definition}</div>
          </div>
        ))}
        {!hasRows && interactive && (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>All caught up — start the quiz whenever you’re ready.</p>
        )}
      </div>
    </aside>
  );
}
