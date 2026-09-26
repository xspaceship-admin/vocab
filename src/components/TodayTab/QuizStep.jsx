export default function QuizStep({ items, index, answers, onAnswer, onNext, onSubmit }) {
  const item = items[index];
  const pct = Math.round((index / items.length) * 100);
  const isLast = index === items.length - 1;
  const currentAnswer = answers.get(item.wordId);

  const handleNext = () => {
    if (isLast) onSubmit();
    else onNext();
  };

  return (
    <div className="card">
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="q-count">
        Question {index + 1} of {items.length}
      </div>
      {item.type === 'mc' ? (
        <>
          <div className="q-text">
            What does <strong>{item.term}</strong> mean here?
          </div>
          <div className="options">
            {item.options.map((opt, i) => (
              <button
                key={i}
                className={`option-btn${currentAnswer === String(i) ? ' selected' : ''}`}
                onClick={() => onAnswer(item.wordId, String(i))}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="q-text">Fill in the blank:</div>
          <p style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 16 }}>
            {item.fillSentence.split('_____')[0]}
            <span className="blank">_____</span>
            {item.fillSentence.split('_____')[1] || ''}
          </p>
          <div className="options">
            {item.options.map((opt) => (
              <button
                key={opt}
                className={`option-btn${currentAnswer === opt ? ' selected' : ''}`}
                onClick={() => onAnswer(item.wordId, opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="row">
        <span />
        <button className="btn" disabled={currentAnswer === undefined} onClick={handleNext}>
          {isLast ? 'Submit quiz' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
