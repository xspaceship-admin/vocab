import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useStats } from '../context/StatsContext.jsx';
import PracticeQuiz from './ProgressTab/PracticeQuiz.jsx';
import HistoryPanel from './ProgressTab/HistoryPanel.jsx';

const CATEGORY_ORDER = ['idiom', 'sat', 'phrase', 'concept', 'favorite'];
const CATEGORY_LABEL = { idiom: 'Idioms', sat: 'SAT words', phrase: 'Phrases', concept: 'Concepts', favorite: 'Favorites' };

function StatsSidebar({ summary, history, onOpenHistory }) {
  const catOrder = CATEGORY_ORDER.filter((c) => summary.byCategory[c]?.total > 0);
  return (
    <div className="card">
      <div className="stat-grid">
        <div className="stat-box">
          <div className="num">{summary.mastered}</div>
          <div className="lbl">
            mastered
            <span className="stat-info-icon" title="A word is mastered after 3 correct answers in a row.">i</span>
          </div>
        </div>
        <div className="stat-box">
          <div className="num">{summary.inProgress}</div>
          <div className="lbl">in progress</div>
        </div>
        <div className="stat-box">
          <div className="num">{summary.untouched}</div>
          <div className="lbl">not started</div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        {catOrder.map((c) => {
          const b = summary.byCategory[c] || { total: 0, mastered: 0 };
          const pct = b.total ? Math.round((b.mastered / b.total) * 100) : 0;
          return (
            <div className="cat-row" key={c}>
              <div className="name">{CATEGORY_LABEL[c]}</div>
              <div className="track">
                <div className="fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="count">{b.mastered}/{b.total}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProgressTab({ onGoToToday }) {
  const { refresh } = useStats();
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    Promise.all([api('/api/stats'), api('/api/today')])
      .then(([stats]) => {
        setSummary(stats.summary);
        setHistory(stats.history);
        refresh();
      })
      .catch(setError);
  }, []);

  if (error) return <div className="card error-box">{error.message}</div>;
  if (!summary) return <div className="spinner" />;

  return (
    <>
      <div className="progress-layout">
        <div className="practice-col">
          <PracticeQuiz onSummaryUpdate={(s) => setSummary(s)} />
        </div>
        <aside className="progress-aside">
          <StatsSidebar summary={summary} history={history} onOpenHistory={() => setHistoryOpen(true)} />
        </aside>
      </div>
      {historyOpen && (
        <HistoryPanel history={history} onClose={() => setHistoryOpen(false)} />
      )}
    </>
  );
}
