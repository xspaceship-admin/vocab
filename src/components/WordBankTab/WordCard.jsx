import { useState, useEffect } from 'react';
import { StarFilledIcon, SpeakerIcon, ArchiveIcon } from '../../icons.jsx';

function renderInlineBold(text) {
  return text.split(/(\*\*.+?\*\*)/g).map((part, i) => {
    const m = part.match(/^\*\*(.+)\*\*$/);
    return m ? <strong key={i}>{m[1]}</strong> : <span key={i}>{part}</span>;
  });
}

async function fetchPhonetics(term) {
  try {
    const res = await fetch(`/api/phonetics?term=${encodeURIComponent(term)}`);
    if (!res.ok) return null;
    const { phonetics } = await res.json();
    return phonetics || null;
  } catch {
    return null;
  }
}

export default function WordCard({ word, onRemove, onArchive }) {
  const p = word.progress;
  const statusText = p?.mastered ? 'Mastered' : p && p.exposures > 0 ? `Streak ${p.streak}/3` : 'Not tested yet';
  const isFavorite = word.category === 'favorite';

  const [phonetic, setPhonetic] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPhonetics(word.term).then((result) => {
      if (cancelled || !result) return;
      if (result.text) setPhonetic(result.text);
    });
    return () => { cancelled = true; };
  }, [word.term]);

  function handlePlay() {
    if (playing || !('speechSynthesis' in window)) return;
    setPlaying(true);
    const utt = new SpeechSynthesisUtterance(word.term);
    utt.lang = 'en-GB';
    const voices = window.speechSynthesis.getVoices();
    const britishMale = voices.find((v) => v.lang === 'en-GB' && /daniel|male/i.test(v.name))
      || voices.find((v) => v.lang === 'en-GB');
    if (britishMale) utt.voice = britishMale;
    utt.onend = () => setPlaying(false);
    utt.onerror = () => setPlaying(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  }

  return (
    <div className="card" style={{ border: '1px solid var(--ink)' }}>
      <div className="row" style={{ marginTop: 0, alignItems: 'flex-start' }}>
        <strong
          className="defs-term wordcard-term"
          style={{ fontSize: 'var(--fs-lg)', fontFamily: 'var(--font-display)', display: 'block' }}
        >
          {word.term}
        </strong>
        <div className="wordcard-header-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="topic-tag" style={{ margin: 0, borderRadius: 999 }}>
            {word.category}
          </span>
          <span className={`status-pill${p?.mastered ? ' mastered' : ''}`}>{statusText}</span>
          {isFavorite && (
            <button className="defs-icon-btn" title="Unfavorite" onClick={() => onRemove(word.id)}>
              <StarFilledIcon />
            </button>
          )}
          <button
            className="defs-icon-btn"
            title={word.archived ? 'Unarchive' : 'Archive'}
            onClick={() => onArchive(word.id, !word.archived)}
          >
            <ArchiveIcon />
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        {phonetic && (
          <span
            style={{
              fontSize: 'var(--fs-sm)',
              color: 'var(--muted)',
              fontFamily: 'var(--font-mono-round)',
              letterSpacing: '0.01em',
            }}
          >
            {phonetic}
          </span>
        )}
        <button
          className="defs-icon-btn"
          title="Play pronunciation"
          onClick={handlePlay}
          style={{ opacity: playing ? 0.4 : 1, color: playing ? 'var(--accent)' : undefined, width: 28, height: 28 }}
        >
          <SpeakerIcon playing={playing} size={18} />
        </button>
      </div>
      <p style={{ margin: '8px 0 4px' }}>{word.definition}</p>
      {word.example && (
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>{renderInlineBold(word.example)}</p>
      )}
    </div>
  );
}
