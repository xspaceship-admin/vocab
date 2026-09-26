export default function Results({ results, onViewProgress }) {
  return (
    <>
      <div className="card center">
        {results.alreadyCompleted && (
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>You already finished today’s quiz — here’s how you did:</p>
        )}
        <div className="score-hero">
          {results.score}/{results.total}
        </div>
        <div className="xp-line">+{results.xpGained} XP</div>
        {results.newlyMastered.length > 0 && (
          <>
            <p style={{ marginTop: 14, fontWeight: 700, color: 'var(--good)' }}>Newly mastered</p>
            <div className="mastery-list">
              {results.newlyMastered.map((t) => (
                <span className="chip" key={t}>
                  {t}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Breakdown</h2>
        {results.details.map((d) => (
          <div className="result-item" key={d.wordId}>
            <div>
              <div>
                <strong>{d.term}</strong>
              </div>
              {!d.correct && (
                <div className="meta-note">
                  Your answer: {d.response || '(blank)'} — correct: {d.correctAnswer}
                </div>
              )}
            </div>
            <span className={`badge ${d.correct ? 'correct' : 'wrong'}`}>{d.correct ? 'Correct' : 'Missed'}</span>
          </div>
        ))}
      </div>
      <button className="btn secondary" style={{ width: '100%' }} onClick={onViewProgress}>
        View my progress →
      </button>
      <p className="center" style={{ color: 'var(--muted)', fontSize: 12, marginTop: 14 }}>
        Come back tomorrow for a new article!
      </p>
    </>
  );
}
