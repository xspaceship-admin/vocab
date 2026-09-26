import { useStats } from '../context/StatsContext.jsx';

const TABS = [
  { key: 'archive', label: 'Archive' },
  { key: 'favorites', label: 'Word Bank' },
  { key: 'progress', label: 'Progress' },
];

export default function Topbar({ tab, onTabChange, onNewArticle }) {
  const { summary } = useStats();

  return (
    <header className="topbar">
      <div className="brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Vocab News
      </div>
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn${tab === t.key ? ' active' : ''}`}
            onClick={() => onTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <button className="nav-btn" title="Generate a new article" onClick={onNewArticle}>
        New article
      </button>
      <div className="xp-pill">{summary ? `XP ${summary.xp} · Streak ${summary.streakDays}` : 'XP 0 · Streak 0'}</div>
    </header>
  );
}
