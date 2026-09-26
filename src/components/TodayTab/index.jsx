import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { useStats } from '../../context/StatsContext.jsx';
import ArticleBody from '../ArticleBody.jsx';
import DefsPanel from '../DefsPanel.jsx';
import QuizStep from './QuizStep.jsx';
import Results from './Results.jsx';

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

// Owns the whole Today flow: loading -> reading -> quiz -> results (or error
// at any point). Stays mounted across tab switches so the "New article"
// topbar button (which can fire from any tab) reliably reaches it via the
// `newArticleRequestId` counter.
export default function TodayTab({ newArticleRequestId, onActiveQuizChange, onGoToProgress, onArticleLoaded }) {
  const { refresh: refreshStats } = useStats();
  const [phase, setPhase] = useState('loading'); // loading | reading | quiz | results | error
  const [loadingMessage, setLoadingMessage] = useState("Fetching today's news…");
  const [article, setArticle] = useState(null);
  const [articleDate, setArticleDate] = useState(null);
  const [quizItems, setQuizItems] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [answers, setAnswers] = useState(new Map());
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const lastRequestId = useRef(newArticleRequestId);

  const applyTodayData = (data) => {
    setArticle(data.article);
    setArticleDate(data.date);
    onArticleLoaded?.(data.article.title);
    if (data.completed) {
      setResults({ ...data.results, alreadyCompleted: true });
      setPhase('results');
    } else {
      setQuizItems(data.quiz);
      setQuizIndex(0);
      setAnswers(new Map());
      setPhase('reading');
    }
  };

  const load = async () => {
    setPhase('loading');
    setLoadingMessage("Fetching today's news…");
    try {
      applyTodayData(await api('/api/today'));
    } catch (err) {
      setError(err);
      setPhase('error');
    }
  };

  const regenerate = async (topic, force) => {
    setPhase('loading');
    setLoadingMessage(`Getting a new${topic ? ` ${topic}` : ''} article…`);
    try {
      const data = await api('/api/regenerate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic, force }),
      });
      applyTodayData(data);
    } catch (err) {
      setError(err);
      setPhase('error');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (newArticleRequestId !== lastRequestId.current) {
      lastRequestId.current = newArticleRequestId;
      regenerate(undefined, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newArticleRequestId]);

  const targetWords = quizItems.map((q) => ({ term: q.term, wordId: q.wordId, definition: q.definition }));

  const skipWord = async (wordId) => {
    const res = await api('/api/skip-word', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wordId }),
    });
    setQuizItems(res.quiz);
  };

  useEffect(() => {
    onActiveQuizChange(phase === 'reading' ? { targetWords, skipWord } : null);
    return () => onActiveQuizChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, quizItems]);

  const submitQuiz = async () => {
    setPhase('loading');
    setLoadingMessage('Grading…');
    const answerList = Array.from(answers.entries()).map(([wordId, response]) => ({ wordId, response }));
    try {
      const res = await api('/api/submit-quiz', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: answerList }),
      });
      setResults(res);
      setPhase('results');
      refreshStats();
    } catch (err) {
      setError(err);
      setPhase('error');
    }
  };

  const handleStartQuiz = () => {
    if (quizItems.length === 0) {
      submitQuiz(); // every word got marked "already know it"
    } else {
      setPhase('quiz');
    }
  };

  if (phase === 'loading') {
    return (
      <>
        <div className="spinner" />
        <p className="center" style={{ color: 'var(--muted)' }}>
          {loadingMessage}
        </p>
      </>
    );
  }

  if (phase === 'error') {
    return (
      <div className="card">
        <h1 className="title">Couldn't load today's news</h1>
        <div className="error-box">{error.message}</div>
        {error.message.includes('ANTHROPIC_API_KEY') && (
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>
            Copy <code>.env.example</code> to <code>.env</code> in the project folder, add your Anthropic API key, then restart
            the server.
          </p>
        )}
        <button className="btn secondary" style={{ marginTop: 14 }} onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  if (phase === 'quiz') {
    return (
      <QuizStep
        items={quizItems}
        index={quizIndex}
        answers={answers}
        onAnswer={(wordId, response) => setAnswers((prev) => new Map(prev).set(wordId, response))}
        onNext={() => setQuizIndex((i) => i + 1)}
        onSubmit={submitQuiz}
      />
    );
  }

  if (phase === 'results') {
    return (
      <div className="reading-layout">
        <div className="article-col">
          <div className="card">
            <div className="row" style={{ marginTop: 0, alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="topic-tag" style={{ marginBottom: 0 }}>{article.topic}</span>
                  <span className="badge correct">{results.score}/{results.total}</span>
                </div>
                <div className="title" style={{ marginTop: 6 }}>{article.title}</div>
                {articleDate && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{articleDate}</div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <ArticleBody body={article.body} targetWords={[]} />
              <SourceLine source={article.source} />
            </div>
          </div>
        </div>
        <aside className="defs-panel">
          <div className="defs-panel-header" style={{ justifyContent: 'center' }}>
            <span className="defs-panel-title" style={{ fontFamily: 'var(--font-sans)', textTransform: 'lowercase' }}>
              {results.score}/{results.total} &nbsp;·&nbsp;
            </span>
            <span className="xp-line" style={{ fontSize: 'var(--fs-base)' }}>+{results.xpGained} XP</span>
          </div>
          {results.newlyMastered?.length > 0 && (
            <div className="mastery-list" style={{ marginBottom: 14 }}>
              {results.newlyMastered.map((t) => (
                <span className="chip" key={t}>{t}</span>
              ))}
            </div>
          )}
          <div className="defs-list">
            {results.details?.map((d) => (
              <div className="defs-row" key={d.wordId}>
                <div className="defs-row-head">
                  <span className="defs-term">{d.term}</span>
                  <span className={`badge ${d.correct ? 'correct' : 'wrong'}`}>{d.correct ? 'correct' : 'missed'}</span>
                </div>
                {!d.correct && (
                  <div className="meta-note" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    correct: {d.correctAnswer}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button className="nav-btn" style={{ width: '100%', marginTop: 16 }} onClick={onGoToProgress}>
            View my progress →
          </button>
        </aside>
      </div>
    );
  }

  return (
    <div className="reading-layout">
      <div className="article-col">
        <div className="card">
          <div className="row" style={{ marginTop: 0, alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="topic-tag" style={{ marginBottom: 0 }}>{article.topic}</span>
                <span className="badge wrong">not quizzed yet</span>
              </div>
              <div className="title" style={{ marginTop: 6 }}>{article.title}</div>
              {articleDate && (
                <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{articleDate}</div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <ArticleBody body={article.body} targetWords={targetWords} interactive onSkipWord={skipWord} />
            <SourceLine source={article.source} />
          </div>
        </div>
      </div>
      <DefsPanel
        body={article.body}
        targetWords={targetWords}
        interactive
        onSkipWord={skipWord}
        onStartQuiz={handleStartQuiz}
      />
    </div>
  );
}
