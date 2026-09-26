import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import TodayTab from '../TodayTab/index.jsx';
import ArchiveCard from './ArchiveCard.jsx';

export default function ArchiveView({ newArticleRequestId, onActiveQuizChange, onGoToProgress }) {
  const [pastArticles, setPastArticles] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [todayTitle, setTodayTitle] = useState(null);

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
