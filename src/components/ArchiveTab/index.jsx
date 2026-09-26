import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import ArchiveCard from './ArchiveCard.jsx';

export default function ArchiveTab() {
  const [articles, setArticles] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let cancelled = false;
    api('/api/archive')
      .then(({ articles }) => {
        if (cancelled) return;
        setArticles(articles);
        setExpanded(Object.fromEntries(articles.map((_, i) => [i, true])));
      })
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="card error-box">{error.message}</div>;
  if (!articles) return <div className="spinner" />;
  if (!articles.length) {
    return (
      <div className="card center" style={{ color: 'var(--muted)' }}>
        No articles generated yet — check back after today’s news loads.
      </div>
    );
  }

  const scrollTo = (i) => {
    document.getElementById(`archiveCard-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
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
            expanded={expanded[i] !== false}
            onToggle={() => setExpanded((prev) => ({ ...prev, [i]: prev[i] === false }))}
          />
        ))}
      </div>
    </div>
  );
}
