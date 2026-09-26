import { useStats } from '../context/StatsContext.jsx';

const CATEGORY_ORDER = ['idiom', 'sat', 'phrase', 'concept', 'favorite'];
const CATEGORY_LABEL = { idiom: 'Idioms', sat: 'SAT words', phrase: 'Phrases', concept: 'Concepts', favorite: 'Favorites' };

export default function StatsSheet({ open, onClose }) {
  const { summary } = useStats();

  if (!open) return null;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />

        {!summary ? (
          <div className="spinner" />
        ) : (
          <>
            <div className="stat-grid" style={{ marginBottom: 24 }}>
              <div className="stat-box">
                <div className="num">{summary.mastered}</div>
                <div className="lbl">mastered</div>
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

            {CATEGORY_ORDER.filter((c) => summary.byCategory?.[c]?.total > 0).map((c) => {
              const b = summary.byCategory[c];
              const pct = b.total ? Math.round((b.mastered / b.total) * 100) : 0;
              return (
                <div className="cat-row" key={c}>
                  <div className="name">{CATEGORY_LABEL[c]}</div>
                  <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
                  <div className="count">{b.mastered}/{b.total}</div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
