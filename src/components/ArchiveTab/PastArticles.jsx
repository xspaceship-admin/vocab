import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import ArchiveCard from './ArchiveCard.jsx';

export default function PastArticles() {
  const [articles, setArticles] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    api('/api/archive')
      .then(({ articles }) => {
        const past = articles.slice(1); // skip first = today's (shown by TodayTab above)
        setArticles(past);
        setExpanded(Object.fromEntries(past.map((_, i) => [i, true]))); // all expanded
      })
      .catch(() => setArticles([]));
  }, []);

  if (!articles?.length) return null;

  const scrollTo = (i) => {
    document.getElementById(`archiveCard-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ marginTop: 40 }}>
      <div className="archive-layout">
        <aside className="archive-nav">
          <div className="archive-nav-list">
            {articles.map((a, i) => (
              <button key={i} className="archive-nav-item" onClick={() => scrollTo(i)}>
                <span className="archive-nav-title">{a.article.title}</span>
              </button>
            ))}
          </div>
        </aside>
        <div className="archive-main">
          {articles.map((a, i) => (
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
    </div>
  );
}
