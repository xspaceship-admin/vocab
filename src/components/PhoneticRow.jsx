import { useState, useEffect } from 'react';
import { SpeakerIcon } from '../icons.jsx';

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

function speakBritishMale(term, setPlaying) {
  if (!('speechSynthesis' in window)) return;
  setPlaying(true);
  const utt = new SpeechSynthesisUtterance(term);
  utt.lang = 'en-GB';
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang === 'en-GB' && /daniel|male/i.test(v.name))
    || voices.find((v) => v.lang === 'en-GB');
  if (voice) utt.voice = voice;
  utt.onend = () => setPlaying(false);
  utt.onerror = () => setPlaying(false);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utt);
}

export default function PhoneticRow({ term, style }) {
  const [phonetic, setPhonetic] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPhonetics(term).then((result) => {
      if (cancelled || !result) return;
      if (result.text) setPhonetic(result.text);
    });
    return () => { cancelled = true; };
  }, [term]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      {phonetic && (
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.01em' }}>
          {phonetic}
        </span>
      )}
      <button
        className="defs-icon-btn"
        title="Play pronunciation"
        onClick={(e) => { e.stopPropagation(); speakBritishMale(term, setPlaying); }}
        style={{ opacity: playing ? 0.4 : 1, color: playing ? 'var(--accent)' : undefined, width: 22, height: 22 }}
      >
        <SpeakerIcon playing={playing} size={14} />
      </button>
    </div>
  );
}
