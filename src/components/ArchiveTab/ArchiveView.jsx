import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import TodayTab from '../TodayTab/index.jsx';
import ArchiveCard from './ArchiveCard.jsx';

function ArticlesSheet({ open, onClose, todayTitle, pastArticles, onScrollToToday, onScrollTo }) {
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="archive-nav-list">
          <button className="archive-nav-item" onClick={() => { onScrollToToday(); onClose(); }}>
            <span className="archive-nav-title">{todayTitle || 'Today'}</span>
          </button>
          {pastArticles?.map((a, i) => (
            <button key={i} className="archive-nav-item" onClick={() => { onScrollTo(i); onClose(); }}>
              <span className="archive-nav-title">{a.article.title}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function ArchiveView({ newArticleRequestId, onActiveQuizChange, onGoToProgress }) {
  const [pastArticles, setPastArticles] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [todayTitle, setTodayTitle] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    api('/api/archive')
      .then(({ articles }) => {
        const past = articles.slice(1);
        setPastArticles(past);
        setExpanded(Object.fromEntries(past.map((_, i) => [i, true])));
      })
      .catch(() => setPastArticles([]));
  }, []);

  const scrollToToday = () =>
    document.getElementById('archiveToday')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const scrollTo = (i) =>
    document.getElementById(`archiveCard-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="archive-layout" style={{ marginTop: 40 }}>
      <aside className="archive-nav">
        <div className="archive-nav-list">
          <button className="archive-nav-item" onClick={scrollToToday}>
            <span className="archive-nav-title">{todayTitle || 'Today'}</span>
          </button>
          {pastArticles?.map((a, i) => (
            <button key={i} className="archive-nav-item" onClick={() => scrollTo(i)}>
              <span className="archive-nav-title">{a.article.title}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Mobile-only: floating button + bottom sheet */}
      <button className="archive-nav-mobile-btn" onClick={() => setSheetOpen(true)}>
        Articles ↑
      </button>
      <ArticlesSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        todayTitle={todayTitle}
        pastArticles={pastArticles}
        onScrollToToday={scrollToToday}
        onScrollTo={scrollTo}
      />
      <div className="archive-main">
        <div id="archiveToday">
          <TodayTab
            newArticleRequestId={newArticleRequestId}
            onActiveQuizChange={onActiveQuizChange}
            onGoToProgress={onGoToProgress}
            onArticleLoaded={setTodayTitle}
          />
        </div>
        {pastArticles?.map((a, i) => (
          <ArchiveCard
            key={a.date + i}
            index={i}
            data={a}
            expanded={!!expanded[i]}
            onToggle={() => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))}
          />
        ))}
      </div>
    </div>
  );
}
