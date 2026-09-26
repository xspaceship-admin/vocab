import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { loadEnv } from './lib/env.js';
import { readJson, writeJson, todayStr, yesterdayStr, DEFAULT_PROGRESS, DEFAULT_STATE } from './lib/store.js';
import {
  pickWordsForToday,
  assignQuizTypes,
  addFillOptions,
  gradeAnswer,
  applyResult,
  markWordKnown,
  summarize,
  MASTERY_STREAK,
} from './lib/mastery.js';
import { generateArticle, defineTerm, getIPA, getExample } from './lib/claude.js';
import { fetchLatestStory, TOPICS } from './lib/newsFeed.js';
import { VOCAB_BANK } from './lib/vocabBank.js';

loadEnv();

const PORT = process.env.PORT || 5175;
const PUBLIC_DIR = path.resolve('dist');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

function loadFavorites() {
  return readJson('favorites', []);
}

// The pool a day's article is drawn from: the built-in bank plus anything the
// user has added to their favorites.
function fullBank(favorites) {
  return [...VOCAB_BANK, ...favorites];
}

function clientSafeQuiz(quiz) {
  return quiz.map((item) => {
    const definition = item.definition || VOCAB_BANK.find((w) => w.id === item.wordId)?.definition || null;
    if (item.type === 'mc') {
      return { wordId: item.wordId, term: item.term, definition, type: 'mc', question: item.question, options: item.options };
    }
    return { wordId: item.wordId, term: item.term, definition, type: 'fill', fillSentence: item.fillSentence, options: item.options };
  });
}

// Picks which topic to source today's real story from. With a forced topic
// (the user explicitly chose one from the "New article" picker) it sticks to
// that topic only; otherwise it alternates from whichever topic wasn't used
// last time.
async function pickStory(history, forcedTopic) {
  const usedLinks = history.map((h) => h.article?.source?.link).filter(Boolean);

  if (forcedTopic) {
    const story = await fetchLatestStory(forcedTopic, usedLinks);
    return story || { topic: forcedTopic, fallback: true };
  }

  const lastTopic = history[history.length - 1]?.article?.topic;
  const preferred = TOPICS.filter((t) => t !== lastTopic);
  const order = (preferred.length ? preferred : TOPICS).sort(() => Math.random() - 0.5);

  for (const topic of order) {
    const story = await fetchLatestStory(topic, usedLinks);
    if (story) return story;
  }
  // Both feeds were unreachable: fall back to an ungrounded article rather than failing outright.
  return { topic: order[0], fallback: true };
}

const REGENERATIONS_PER_DAY = 20;

async function generateTodaysArticle(progress, forcedTopic) {
  const history = readJson('history', []);
  const bank = fullBank(loadFavorites());
  const story = await pickStory(history, forcedTopic);
  const words = assignQuizTypes(pickWordsForToday(progress, bank, story.topic));
  const article = await generateArticle(words, story);
  article.quiz = addFillOptions(article.quiz, words, bank);
  article.id = randomUUID();
  return article;
}

async function getToday() {
  const today = todayStr();
  const state = readJson('state', DEFAULT_STATE);
  const progress = readJson('progress', DEFAULT_PROGRESS);

  if (state.lastArticleDate !== today || !state.currentArticle) {
    const article = await generateTodaysArticle(progress);
    const fresh = { lastArticleDate: today, currentArticle: article, completedToday: false, results: null, regenCount: 0 };
    writeJson('state', fresh);
    archiveArticle(today, article);
    return respondToday(today, fresh);
  }
  return respondToday(today, state);
}

// Lets the user swap out today's article for a fresh one — optionally on a
// topic they explicitly chose — as long as they haven't hit the daily cap
// (keeps this from running away with API cost). Normally this is blocked
// once the quiz is completed (that would discard a real score), but the
// top-nav "New article" button passes force=true to get a new article on
// demand regardless.
async function regenerateToday(requestedTopic, force) {
  const today = todayStr();
  const state = readJson('state', DEFAULT_STATE);
  if (state.lastArticleDate !== today || !state.currentArticle) {
    return getToday();
  }
  if (state.completedToday && !force) {
    throw new Error('You already completed today’s quiz, so regenerating would lose that score.');
  }
  const regenCount = state.regenCount || 0;
  if (regenCount >= REGENERATIONS_PER_DAY) {
    throw new Error(`You’ve used all ${REGENERATIONS_PER_DAY} regenerations for today — check back tomorrow for a new article.`);
  }
  const forcedTopic = TOPICS.includes(requestedTopic) ? requestedTopic : undefined;

  const progress = readJson('progress', DEFAULT_PROGRESS);
  const article = await generateTodaysArticle(progress, forcedTopic);
  const fresh = { lastArticleDate: today, currentArticle: article, completedToday: false, results: null, regenCount: regenCount + 1 };
  writeJson('state', fresh);
  archiveArticle(today, article);
  return respondToday(today, fresh);
}

// Archives every generated article (regardless of whether the quiz gets completed)
// so past news stays browsable. Always appended, never replaced — even a same-day
// regeneration keeps the article(s) that came before it, so nothing gets lost.
function archiveArticle(date, article) {
  const history = readJson('history', []);
  history.push({
    id: article.id,
    date,
    article: { title: article.title, topic: article.topic, source: article.source, body: article.body },
    quiz: article.quiz,
    results: null,
  });
  writeJson('history', history.slice(-90));
}

// Finds the history entry for the article currently active in `state`. Matches
// by id (set on every article since it always has one going forward); falls
// back to matching by date for a state.json saved before ids existed.
function findCurrentHistoryEntry(history, state, today) {
  if (state.currentArticle?.id) {
    return history.find((h) => h.id === state.currentArticle.id);
  }
  return history.find((h) => h.date === today);
}

function respondToday(date, state) {
  const { title, topic, source, body, quiz } = state.currentArticle;
  return {
    date,
    article: { title, topic, source, body },
    quiz: clientSafeQuiz(quiz),
    completed: state.completedToday,
    results: state.results,
    regensLeft: Math.max(0, REGENERATIONS_PER_DAY - (state.regenCount || 0)),
  };
}

async function submitQuiz(payload) {
  const today = todayStr();
  const state = readJson('state', DEFAULT_STATE);
  if (!state.currentArticle) throw new Error('No article to grade yet. Load today’s news first.');
  if (state.completedToday) {
    return { ...state.results, alreadyCompleted: true };
  }

  const progress = readJson('progress', DEFAULT_PROGRESS);
  const answers = new Map((payload.answers || []).map((a) => [a.wordId, a.response]));

  const details = [];
  let correctCount = 0;
  const newlyMastered = [];

  for (const item of state.currentArticle.quiz) {
    const response = answers.get(item.wordId);
    const correct = gradeAnswer(item, response);
    if (correct) correctCount += 1;
    const { newlyMastered: justMastered } = applyResult(progress, item.wordId, correct, today);
    if (justMastered) newlyMastered.push(item.term);
    details.push({
      wordId: item.wordId,
      term: item.term,
      type: item.type,
      response: response ?? '',
      correct,
      correctAnswer: item.type === 'mc' ? item.options[item.answerIndex] : item.answer,
    });
  }

  const xpGained = details.length * 2 + correctCount * 10 + newlyMastered.length * 25;
  progress.xp += xpGained;

  const yesterday = yesterdayStr(today);
  if (progress.lastActiveDate === today) {
    // already counted today (shouldn't normally happen since completedToday guards this)
  } else if (progress.lastActiveDate === yesterday) {
    progress.streakDays += 1;
  } else {
    progress.streakDays = 1;
  }
  progress.lastActiveDate = today;
  writeJson('progress', progress);

  const results = {
    score: correctCount,
    total: details.length,
    xpGained,
    newlyMastered,
    details,
  };

  state.completedToday = true;
  state.results = results;
  writeJson('state', state);

  const history = readJson('history', []);
  const entry = findCurrentHistoryEntry(history, state, today);
  if (entry) entry.results = results;
  writeJson('history', history);

  return { ...results, alreadyCompleted: false };
}

// The user already knows a highlighted word — mark it mastered outright and
// drop it from today's remaining quiz (and today's archived copy) so they
// aren't tested on something they said they know.
function skipWord(wordId) {
  const today = todayStr();
  const state = readJson('state', DEFAULT_STATE);
  if (!state.currentArticle) throw new Error('No article loaded yet.');
  if (state.completedToday) throw new Error('Today’s quiz is already completed.');

  const idx = state.currentArticle.quiz.findIndex((q) => q.wordId === wordId);
  if (idx === -1) throw new Error('That word isn’t part of today’s quiz.');
  state.currentArticle.quiz.splice(idx, 1);
  writeJson('state', state);

  const progress = readJson('progress', DEFAULT_PROGRESS);
  markWordKnown(progress, wordId, today);
  writeJson('progress', progress);

  const history = readJson('history', []);
  const entry = findCurrentHistoryEntry(history, state, today);
  if (entry) {
    entry.quiz = entry.quiz.filter((q) => q.wordId !== wordId);
    writeJson('history', history);
  }

  return { removedWordId: wordId, quiz: clientSafeQuiz(state.currentArticle.quiz) };
}

function getStats() {
  const progress = readJson('progress', DEFAULT_PROGRESS);
  const bank = fullBank(loadFavorites());
  const history = readJson('history', [])
    .slice(-30)
    .reverse()
    .map((h) => ({ date: h.date, article: h.article, results: h.results }));
  return { summary: summarize(progress, bank), history, masteryStreak: MASTERY_STREAK };
}

function buildPracticeQuestion(word, bank, forceType = null) {
  const exampleCache = readJson('examples', {});
  const example = word.example || exampleCache[word.term] || null;

  // Pick question type: alternate between 'definition' and 'fill' when an example exists
  const canFill = !!example;
  const type = forceType || (canFill && Math.random() < 0.5 ? 'fill' : 'definition');

  if (type === 'fill' && canFill) {
    // Try to replace the term (exact or first-word match) with a blank
    const escaped = word.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let blank = example.replace(new RegExp(escaped, 'i'), '_____');
    // If exact match failed (inflected form), try matching on the first distinctive word
    if (blank === example) {
      const firstWord = word.term.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (firstWord.length > 3) {
        blank = example.replace(new RegExp(`${firstWord}\\w*(?:\\s+\\w+){0,${word.term.split(/\s+/).length - 1}}`, 'i'), '_____');
      }
    }
    // If we still couldn't blank anything, fall back to definition MC
    if (blank === example) {
      const distractors2 = [...bank].filter((w) => w.id !== word.id).sort(() => Math.random() - 0.5).slice(0, 3).map((w) => w.definition);
      const options2 = [word.definition, ...distractors2].sort(() => Math.random() - 0.5);
      return { wordId: word.id, term: word.term, category: word.category, type: 'definition', options: options2 };
    }
    // Distractors are terms from the same category (fallback to any)
    const sameCat = bank.filter((w) => w.id !== word.id && w.category === word.category);
    const pool = sameCat.length >= 3 ? sameCat : bank.filter((w) => w.id !== word.id);
    const distractors = [...pool].sort(() => Math.random() - 0.5).slice(0, 3).map((w) => w.term);
    const options = [word.term, ...distractors].sort(() => Math.random() - 0.5);
    return { wordId: word.id, term: word.term, category: word.category, type: 'fill', prompt: blank, options };
  }

  // Definition MC: pick which definition matches the term
  const distractors = [...bank]
    .filter((w) => w.id !== word.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((w) => w.definition);
  const options = [word.definition, ...distractors].sort(() => Math.random() - 0.5);
  return { wordId: word.id, term: word.term, category: word.category, type: 'definition', options };
}

function getPracticeQuestion() {
  const progress = readJson('progress', DEFAULT_PROGRESS);
  const bank = fullBank(loadFavorites());
  const withState = bank.map((w) => ({ word: w, p: progress.words[w.id] || { exposures: 0, streak: 0, mastered: false } }));

  const inProgress = withState.filter((x) => x.p.exposures > 0 && !x.p.mastered)
    .sort((a, b) => a.p.streak - b.p.streak);
  const notStarted = withState.filter((x) => x.p.exposures === 0)
    .sort(() => Math.random() - 0.5);

  const pool = inProgress.length ? inProgress : notStarted.length ? notStarted
    : withState.filter((x) => x.p.mastered).sort((a, b) => (a.p.lastSeen || '').localeCompare(b.p.lastSeen || ''));

  if (!pool.length) return { question: null };

  const topN = Math.min(5, pool.length);
  const picked = pool[Math.floor(Math.random() * topN)].word;
  const summary = summarize(progress, bank);
  return { question: buildPracticeQuestion(picked, bank), summary };
}

function submitPracticeAnswer({ wordId, chosen, questionType }) {
  const bank = fullBank(loadFavorites());
  const word = bank.find((w) => w.id === wordId);
  if (!word) throw new Error('Word not found');

  const correctAnswer = questionType === 'fill' ? word.term : word.definition;
  const correct = chosen === correctAnswer;
  const today = todayStr();
  const progress = readJson('progress', DEFAULT_PROGRESS);
  applyResult(progress, wordId, correct, today);
  if (correct) progress.xp = (progress.xp || 0) + 2;
  writeJson('progress', progress);

  const withState = bank.map((w) => ({ word: w, p: progress.words[w.id] || { exposures: 0, streak: 0, mastered: false } }));
  const allExcluding = withState.filter((x) => x.word.id !== wordId);

  // Always pick a different word next — search tiers in priority order, excluding the just-answered
  const nextInProgress = allExcluding.filter((x) => x.p.exposures > 0 && !x.p.mastered).sort((a, b) => a.p.streak - b.p.streak);
  const nextNotStarted = allExcluding.filter((x) => x.p.exposures === 0).sort(() => Math.random() - 0.5);
  const nextMastered = allExcluding.filter((x) => x.p.mastered).sort((a, b) => (a.p.lastSeen || '').localeCompare(b.p.lastSeen || ''));
  const nextPool = nextInProgress.length ? nextInProgress
    : nextNotStarted.length ? nextNotStarted
    : nextMastered.length ? nextMastered
    : withState; // only one word in the entire bank — no choice
  const topN = Math.min(5, nextPool.length);
  const nextWord = nextPool[Math.floor(Math.random() * topN)]?.word;
  const next = nextWord ? buildPracticeQuestion(nextWord, bank) : null;

  const summary = summarize(progress, bank);
  return {
    correct,
    correctAnswer,
    word: { term: word.term, definition: word.definition, example: word.example || readJson('examples', {})[word.term] || null },
    next,
    summary,
  };
}

function listFavorites() {
  const favorites = loadFavorites();
  const progress = readJson('progress', DEFAULT_PROGRESS);
  return favorites.map((f) => ({ ...f, progress: progress.words[f.id] || null }));
}

function loadArchived() {
  return new Set(readJson('archived', []));
}

function listWordBank() {
  const favorites = loadFavorites();
  const progress = readJson('progress', DEFAULT_PROGRESS);
  const archived = loadArchived();
  const seenBankWords = VOCAB_BANK;
  const combined = [...favorites, ...seenBankWords].map((w) => ({
    ...w,
    progress: progress.words[w.id] || null,
    archived: archived.has(w.id),
  }));
  combined.sort((a, b) => (b.progress?.lastSeen || '').localeCompare(a.progress?.lastSeen || ''));
  return combined;
}

function setWordArchived(wordId, archive) {
  const archived = loadArchived();
  if (archive) archived.add(wordId);
  else archived.delete(wordId);
  writeJson('archived', [...archived]);
  return { wordId, archived: archive };
}

async function addFavorite(payload) {
  const term = String(payload.term || '').trim();
  if (!term) throw new Error('Enter a word or phrase first.');

  const favorites = loadFavorites();
  const existing = [...VOCAB_BANK, ...favorites].find(
    (w) => w.term.toLowerCase() === term.toLowerCase()
  );
  if (existing) {
    const progress = readJson('progress', DEFAULT_PROGRESS);
    return { favorite: { ...existing, progress: progress.words[existing.id] || null }, alreadyExists: true };
  }

  const { definition, example } = await defineTerm(term);
  const favorite = {
    id: `fav-${Date.now()}`,
    term,
    category: 'favorite',
    definition,
    example,
    difficulty: 2,
    addedAt: todayStr(),
  };
  favorites.push(favorite);
  writeJson('favorites', favorites);
  return { favorite: { ...favorite, progress: null }, alreadyExists: false };
}

// Looks up a definition for a word/term that has no stored definition (e.g. an
// older archived quiz word whose bank entry no longer exists). Doesn't save
// anything — it's just an on-demand lookup for the "Show definition" button.
async function defineOnDemand(payload) {
  const term = String(payload.term || '').trim();
  if (!term) throw new Error('Missing term.');
  const bankWord = VOCAB_BANK.find((w) => w.term.toLowerCase() === term.toLowerCase());
  if (bankWord?.definition) return { definition: bankWord.definition };
  return defineTerm(term);
}

async function getPhonetics(term) {
  if (!term) throw new Error('Missing term.');
  const cache = readJson('phonetics', {});
  if (Object.prototype.hasOwnProperty.call(cache, term)) return cache[term];

  try {
    const ipa = await getIPA(term);
    const result = ipa ? { text: ipa } : null;
    cache[term] = result;
    writeJson('phonetics', cache);
    return result;
  } catch {
    return null;
  }
}

function removeFavorite(id) {
  const favorites = loadFavorites();
  const next = favorites.filter((f) => f.id !== id);
  writeJson('favorites', next);
  return { removed: next.length !== favorites.length };
}

// Full archive for browsing/rereading past articles, including the quiz answer key
// (safe to expose here since these days are already generated, and completed ones
// have already been graded).
function getArchive() {
  const byId = new Map(fullBank(loadFavorites()).map((w) => [w.id, w]));
  return readJson('history', [])
    .slice()
    .reverse()
    .map((h) => ({
      date: h.date,
      article: h.article,
      quiz: h.quiz.map((item) => ({
        wordId: item.wordId,
        term: item.term,
        type: item.type,
        question: item.question,
        options: item.options,
        answerIndex: item.answerIndex,
        fillSentence: item.fillSentence,
        answer: item.answer,
        definition: byId.get(item.wordId)?.definition ?? null,
      })),
      results: h.results,
    }));
}

async function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const full = path.join(PUBLIC_DIR, filePath);
  if (!full.startsWith(PUBLIC_DIR) || !existsSync(full)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
    return;
  }
  const ext = path.extname(full);
  const body = await readFile(full);
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data ? JSON.parse(data) : {}));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    if (req.url === '/api/today' && req.method === 'GET') {
      return sendJson(res, 200, await getToday());
    }
    if (req.url === '/api/regenerate' && req.method === 'POST') {
      const payload = await readBody(req);
      return sendJson(res, 200, await regenerateToday(payload.topic, payload.force));
    }
    if (req.url === '/api/skip-word' && req.method === 'POST') {
      const payload = await readBody(req);
      return sendJson(res, 200, skipWord(payload.wordId));
    }
    if (req.url === '/api/submit-quiz' && req.method === 'POST') {
      const payload = await readBody(req);
      return sendJson(res, 200, await submitQuiz(payload));
    }
    if (req.url === '/api/stats' && req.method === 'GET') {
      return sendJson(res, 200, getStats());
    }
    if (req.url === '/api/archive' && req.method === 'GET') {
      return sendJson(res, 200, { articles: getArchive() });
    }
    if (req.url === '/api/favorites' && req.method === 'GET') {
      return sendJson(res, 200, { favorites: listFavorites() });
    }
    if (req.url === '/api/wordbank' && req.method === 'GET') {
      return sendJson(res, 200, { words: listWordBank() });
    }
    if (req.url === '/api/wordbank/archive' && req.method === 'POST') {
      const { wordId, archive } = await readBody(req);
      return sendJson(res, 200, setWordArchived(wordId, !!archive));
    }
    if (req.url === '/api/favorites' && req.method === 'POST') {
      const payload = await readBody(req);
      return sendJson(res, 200, await addFavorite(payload));
    }
    if (req.url.startsWith('/api/favorites/') && req.method === 'DELETE') {
      const id = decodeURIComponent(req.url.slice('/api/favorites/'.length));
      return sendJson(res, 200, removeFavorite(id));
    }
    if (req.url === '/api/define' && req.method === 'POST') {
      const payload = await readBody(req);
      return sendJson(res, 200, await defineOnDemand(payload));
    }
    if (req.url.startsWith('/api/phonetics') && req.method === 'GET') {
      const term = new URL(req.url, 'http://localhost').searchParams.get('term') || '';
      return sendJson(res, 200, { phonetics: await getPhonetics(term.trim()) });
    }
    if (req.url.startsWith('/api/example') && req.method === 'GET') {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const term = params.get('term')?.trim() || '';
      const definition = params.get('definition')?.trim() || '';
      if (!term) return sendJson(res, 200, { example: null });
      const cache = readJson('examples', {});
      if (Object.prototype.hasOwnProperty.call(cache, term)) {
        return sendJson(res, 200, { example: cache[term] });
      }
      const example = await getExample(term, definition);
      cache[term] = example;
      writeJson('examples', cache);
      return sendJson(res, 200, { example });
    }
    if (req.url === '/api/practice-quiz' && req.method === 'GET') {
      return sendJson(res, 200, getPracticeQuestion());
    }
    if (req.url === '/api/practice-quiz/answer' && req.method === 'POST') {
      const payload = await readBody(req);
      return sendJson(res, 200, submitPracticeAnswer(payload));
    }
    return await serveStatic(req, res);
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Vocab News running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('WARNING: ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key.');
  } else {
    // Pre-generate example sentences in the background so they're cached before the user needs them
    (async () => {
      const bank = fullBank(loadFavorites());
      const cache = readJson('examples', {});
      const missing = bank.filter((w) => !Object.prototype.hasOwnProperty.call(cache, w.term));
      if (!missing.length) return;
      console.log(`Pre-generating examples for ${missing.length} words…`);
      for (const w of missing) {
        try {
          cache[w.term] = await getExample(w.term, w.definition);
          writeJson('examples', cache);
        } catch {
          // skip on error, will retry next restart
        }
        await new Promise((r) => setTimeout(r, 300)); // pace to avoid rate limits
      }
      console.log('Example pre-generation complete.');
    })();

    // Pre-generate phonetics (IPA) for all bank words
    (async () => {
      const bank = fullBank(loadFavorites());
      const cache = readJson('phonetics', {});
      const missing = bank.filter((w) => !Object.prototype.hasOwnProperty.call(cache, w.term));
      if (!missing.length) return;
      console.log(`Pre-generating phonetics for ${missing.length} words…`);
      for (const w of missing) {
        try {
          const ipa = await getIPA(w.term);
          cache[w.term] = ipa ? { text: ipa } : null;
          writeJson('phonetics', cache);
        } catch {
          // skip on error, will retry next restart
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      console.log('Phonetics pre-generation complete.');
    })();
  }
});
