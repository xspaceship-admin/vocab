import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import PhoneticRow from '../PhoneticRow.jsx';

function CategoryTag({ category }) {
  return (
    <span className="topic-tag" style={{ margin: 0, borderRadius: 999, textTransform: 'lowercase' }}>
      {category}
    </span>
  );
}

export default function PracticeQuiz({ onSummaryUpdate }) {
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('asking'); // 'asking' | 'answered'
  const [chosen, setChosen] = useState(null);
  const [result, setResult] = useState(null);
  const [example, setExample] = useState(null);
  const [error, setError] = useState(null);

  async function fetchQuestion() {
    setLoading(true);
    setError(null);
    try {
      const { question: q, summary } = await api('/api/practice-quiz');
      setQuestion(q);
      if (summary) onSummaryUpdate(summary);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setPhase('asking');
      setChosen(null);
      setResult(null);
      setExample(null);
    }
  }

  useEffect(() => { fetchQuestion(); }, []);

  async function handleAnswer(opt) {
    if (phase !== 'asking' || !question) return;
    setChosen(opt);
    try {
      const res = await api('/api/practice-quiz/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wordId: question.wordId, chosen: opt, questionType: question.type }),
      });
      setResult(res);
      setPhase('answered');
      setExample(res.word.example || null);
      if (res.summary) onSummaryUpdate(res.summary);
      if (res.correct && !res.word.example) {
        api(`/api/example?term=${encodeURIComponent(res.word.term)}&definition=${encodeURIComponent(res.word.definition)}`)
          .then((d) => { if (d.example) setExample(d.example); })
          .catch(() => {});
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function handleNext() {
    if (result?.next) {
      setQuestion(result.next);
      setPhase('asking');
      setChosen(null);
      setResult(null);
    } else {
      fetchQuestion();
    }
  }

  if (loading) return <div className="card"><div className="spinner" /></div>;
  if (error) return <div className="card error-box">{error}</div>;
  if (!question) return (
    <div className="card" style={{ color: 'var(--muted)', textAlign: 'center' }}>
      No words to practice yet — complete a quiz first.
    </div>
  );

  const isAnswered = phase === 'answered';

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <CategoryTag category={question.category} />
        {isAnswered && result && (
          <span
            className={`badge ${result.correct ? 'correct' : 'wrong'}`}
            style={{ marginLeft: 'auto' }}
          >
            {result.correct ? 'correct' : 'incorrect'}
          </span>
        )}
      </div>

      <div className="q-text" style={{ fontSize: 18, marginBottom: isAnswered ? 8 : 20 }}>
        {question.type === 'fill' ? (
          <>
            Fill in the blank:{' '}
            <em style={{ fontStyle: 'normal', color: 'var(--muted)' }}>{question.prompt}</em>
          </>
        ) : (
          <>What does <strong style={{ fontFamily: 'var(--font-display)' }}>{question.term}</strong> mean?</>
        )}
      </div>

      {isAnswered && result && (
        <PhoneticRow
          term={question.type === 'fill' ? result.correctAnswer : question.term}
          style={{ marginBottom: 16 }}
        />
      )}

      <div className="options">
        {question.options.map((opt, i) => {
          const isCorrectOpt = isAnswered && opt === result?.correctAnswer;
          const isWrongOpt = isAnswered && opt === chosen && !result?.correct;
          let cls = 'option-btn';
          if (isCorrectOpt) cls += ' correct-ans';
          else if (isWrongOpt) cls += ' wrong-ans';
          else if (!isAnswered && opt === chosen) cls += ' selected';

          return (
            <button key={i} className={cls} disabled={isAnswered} onClick={() => handleAnswer(opt)}>
              {opt}
              {isCorrectOpt && question.type === 'fill' && result?.word?.definition && (
                <span style={{ display: 'block', marginTop: 8, fontSize: 14, fontStyle: 'normal', opacity: 0.9 }}>
                  {result.word.definition}
                </span>
              )}
              {isCorrectOpt && question.type !== 'fill' && example && (
                <span style={{ display: 'block', marginTop: 8, fontSize: 14, fontStyle: 'normal', opacity: 0.9 }}>
                  &ldquo;{example.replace(/\*\*/g, '')}&rdquo;
                </span>
              )}
              {isCorrectOpt && question.type !== 'fill' && !example && phase === 'answered' && (
                <span style={{ display: 'block', marginTop: 6, fontSize: 11, opacity: 0.4 }}>loading example…</span>
              )}
            </button>
          );
        })}
      </div>

      {isAnswered && result && (
        <div style={{ marginTop: 16 }}>
          <div className="row" style={{ marginTop: 0 }}>
            <span />
            <button className="nav-btn" onClick={handleNext}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
