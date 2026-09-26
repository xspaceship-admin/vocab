import { useState } from 'react';
import ArticleBody from '../ArticleBody.jsx';
import DefsPanel from '../DefsPanel.jsx';
import { ChevronIcon } from '../../icons.jsx';

function SourceLine({ source }) {
  if (!source) return null;
  return (
    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', marginTop: 10 }}>
      Based on reporting from{' '}
      <a href={source.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
        {source.name}
      </a>
    </p>
  );
}

export default function ArchiveCard({ index, data, expanded, onToggle }) {
  const [skipped, setSkipped] = useState(new Set());

  const statusBadge = data.results ? (
    <span className="badge correct">
      {data.results.score}/{data.results.total}
    </span>
  ) : (
    <span className="badge wrong">Not quizzed yet</span>
  );
  const allTargetWords = data.quiz.map((q) => ({ term: q.term, wordId: q.wordId, definition: q.definition }));
  const targetWords = allTargetWords.filter((w) => !skipped.has(w.wordId));
  const skipWord = (wordId) => setSkipped((prev) => new Set([...prev, wordId]));

  return (
    <div className="reading-layout" id={`archiveCard-${index}`}>
      <div className="article-col">
        <div className="card">
          <div className="row" style={{ marginTop: 0, alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="topic-tag" style={{ marginBottom: 0 }}>
                  {data.article.topic}
                </span>
                {statusBadge}
              </div>
              <div className="title" style={{ marginTop: 6 }}>
                {data.article.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{data.date}</div>
            </div>
            <button
              className={`chevron-btn${expanded ? '' : ' collapsed'}`}
              aria-expanded={expanded}
              title={expanded ? 'Collapse article' : 'Expand article'}
              onClick={onToggle}
            >
              <ChevronIcon />
            </button>
          </div>
          <div style={{ marginTop: 14, display: expanded ? 'block' : 'none' }}>
            <ArticleBody body={data.article.body} targetWords={targetWords} onSkipWord={skipWord} />
            <SourceLine source={data.article.source} />
          </div>
        </div>
      </div>
      <div className="defs-panel-slot" style={{ display: expanded ? 'block' : 'none' }}>
        <DefsPanel body={data.article.body} targetWords={targetWords} onSkipWord={skipWord} />
      </div>
    </div>
  );
}
