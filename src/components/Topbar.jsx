import { useStats } from '../context/StatsContext.jsx';

export const TABS = [
  { key: 'archive', label: 'Archive' },
  { key: 'favorites', label: 'Word Bank' },
  { key: 'progress', label: 'Progress' },
];

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

const TAB_ICONS = { archive: BookIcon, favorites: StarIcon, progress: ChartIcon };

export function BottomTabs({ tab, onTabChange }) {
  return (
    <nav className="bottom-tabs">
      {TABS.map((t) => {
        const Icon = TAB_ICONS[t.key];
        return (
          <button
            key={t.key}
            className={`bottom-tab-btn${tab === t.key ? ' active' : ''}`}
            onClick={() => onTabChange(t.key)}
          >
            <Icon />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function Topbar({ tab, onTabChange, onNewArticle, onOpenStats, onAddWord, onOpenFilters, wbFilterCount }) {
  const { summary } = useStats();

  return (
    <header className="topbar">
      <div className="brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="brand-name">Vocab News</span>
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
      {/* Desktop: always show. Mobile: hide on non-archive tabs */}
      <button className={`nav-btn${tab !== 'archive' ? ' hide-mobile' : ''}`} title="Generate a new article" onClick={onNewArticle}>
        New article
      </button>
      {/* Mobile only: word bank tab actions */}
      {tab === 'favorites' && (
        <div className="wordbank-topbar-actions">
          <button className="nav-btn" onClick={onAddWord}>Add a word</button>
          <button className="nav-btn" onClick={onOpenFilters}>
            Filters{wbFilterCount > 0 ? ` (${wbFilterCount})` : ''} ↑
          </button>
        </div>
      )}
      {/* Desktop: always show. Mobile: hide on word bank tab */}
      <button className={`xp-pill${tab === 'favorites' ? ' hide-mobile' : ''}`} onClick={onOpenStats} style={{ cursor: onOpenStats ? 'pointer' : 'default', border: 'none' }}>
        {summary ? `XP ${summary.xp} · Streak ${summary.streakDays}` : 'XP 0 · Streak 0'}
      </button>
    </header>
  );
}
