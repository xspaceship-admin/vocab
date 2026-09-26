export const MASTERY_STREAK = 3; // consecutive correct reps needed to master a word
export const WORDS_PER_ARTICLE = 6;
const FAVORITE_CATEGORY = 'favorite';

// Every day's article must include at least one of each of these, so a batch
// can never end up e.g. all-idioms. "concept" is filtered to the day's topic
// (technology, politics, or culture) at selection time.
const REQUIRED_CATEGORIES = ['idiom', 'sat', 'phrase', 'concept'];

function progressFor(progress, id) {
  return (
    progress.words[id] || {
      exposures: 0,
      correct: 0,
      incorrect: 0,
      streak: 0,
      mastered: false,
      masteredAt: null,
      lastSeen: null,
    }
  );
}

function favoriteFirst(a, b) {
  const favA = a.word.category === FAVORITE_CATEGORY ? 0 : 1;
  const favB = b.word.category === FAVORITE_CATEGORY ? 0 : 1;
  return favA - favB;
}

// Best single candidate from a pool: a brand-new word (never seen, hardest
// difficulty first — shuffled beforehand so ties between same-difficulty
// words don't always resolve to the same one) beats an unmastered word
// already in progress (closest to mastery, least recently seen), which beats
// falling back to spaced review of an already-mastered one. New material
// takes priority over review so each day's article stays fresh instead of
// recycling the same handful of words, and harder words take priority over
// easier ones so the app keeps leveling up rather than idling on easy picks.
function pickBestFrom(pool) {
  const fresh = shuffled(pool.filter((x) => x.p.exposures === 0)).sort((a, b) => b.word.difficulty - a.word.difficulty);
  if (fresh.length) return fresh[0].word;

  const inProgress = pool
    .filter((x) => x.p.exposures > 0 && !x.p.mastered)
    .sort((a, b) => b.p.streak - a.p.streak || (a.p.lastSeen || '').localeCompare(b.p.lastSeen || ''));
  if (inProgress.length) return inProgress[0].word;

  const mastered = pool.filter((x) => x.p.mastered).sort((a, b) => (a.p.lastSeen || '').localeCompare(b.p.lastSeen || ''));
  return mastered.length ? mastered[0].word : null;
}

// Choose which words today's article should teach/review. First, one word from
// each of REQUIRED_CATEGORIES is guaranteed (so idioms/SAT/phrases/tech-or-politics
// terminology all always show up). The remaining slots go to brand-new words first
// (so each article introduces a fresh batch), then favorited-but-untested words,
// then other unmastered words still in progress. `bank` is the full vocab pool for
// the day (VOCAB_BANK plus the user's favorites); `topic` is today's chosen story
// topic ('technology', 'politics', or 'culture'), used to pick a relevant concept term.
export function pickWordsForToday(progress, bank, topic) {
  const withState = bank.map((w) => ({ word: w, p: progressFor(progress, w.id) }));
  const chosen = [];
  const chosenIds = new Set();

  for (const category of REQUIRED_CATEGORIES) {
    const pool = withState.filter(
      (x) => x.word.category === category && (category !== 'concept' || x.word.topic === topic)
    );
    const pick = pickBestFrom(pool);
    if (pick) {
      chosen.push(pick);
      chosenIds.add(pick.id);
    }
  }

  const remaining = withState.filter((x) => !chosenIds.has(x.word.id));

  const inProgress = remaining
    .filter((x) => x.p.exposures > 0 && !x.p.mastered)
    .sort((a, b) => {
      const fav = favoriteFirst(a, b);
      if (fav !== 0) return fav;
      if (b.p.streak !== a.p.streak) return b.p.streak - a.p.streak; // closer to mastery first
      return (a.p.lastSeen || '').localeCompare(b.p.lastSeen || ''); // least recently seen first
    });

  // Shuffled first so ties don't always resolve the same way, then sorted so
  // favorites come first and — among non-favorites — harder words come
  // before easier ones, keeping each day's new batch as challenging as the
  // remaining fresh pool allows rather than defaulting to the easiest picks.
  const fresh = shuffled(remaining.filter((x) => x.p.exposures === 0)).sort((a, b) => {
    const fav = favoriteFirst(a, b);
    if (fav !== 0) return fav;
    return b.word.difficulty - a.word.difficulty;
  });

  for (const x of fresh) {
    if (chosen.length >= WORDS_PER_ARTICLE) break;
    chosen.push(x.word);
    chosenIds.add(x.word.id);
  }
  for (const x of inProgress) {
    if (chosen.length >= WORDS_PER_ARTICLE) break;
    if (chosenIds.has(x.word.id)) continue;
    chosen.push(x.word);
    chosenIds.add(x.word.id);
  }

  if (chosen.length < WORDS_PER_ARTICLE) {
    // Everything is mastered or the bank is small: fall back to spaced review of
    // mastered words, oldest lastSeen first, so the app never runs out of content.
    const mastered = withState
      .filter((x) => x.p.mastered && !chosenIds.has(x.word.id))
      .sort((a, b) => (a.p.lastSeen || '').localeCompare(b.p.lastSeen || ''));
    for (const x of mastered) {
      if (chosen.length >= WORDS_PER_ARTICLE) break;
      chosen.push(x.word);
      chosenIds.add(x.word.id);
    }
  }

  return chosen;
}

// Split the chosen words into which quiz format each one gets, so every day's
// quiz mixes multiple-choice and fill-in-the-blank as requested.
export function assignQuizTypes(words) {
  return words.map((w, i) => ({ ...w, quizType: i % 2 === 0 ? 'mc' : 'fill' }));
}

function shuffled(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// Fill-in-the-blank items are answered by picking from options, like multiple
// choice, instead of typing — so each one needs a small word bank of plausible
// wrong terms. Distractors are pulled from the other words in today's batch
// (falling back to the wider bank if there aren't enough).
export function addFillOptions(quiz, dayWords, bank) {
  const dayTerms = dayWords.map((w) => w.term);
  return quiz.map((item) => {
    if (item.type !== 'fill') return item;
    let distractors = shuffled(dayTerms.filter((t) => t !== item.term)).slice(0, 3);
    if (distractors.length < 3) {
      const extra = shuffled(bank.map((w) => w.term)).filter(
        (t) => t !== item.term && !distractors.includes(t)
      );
      distractors = distractors.concat(extra).slice(0, 3);
    }
    return { ...item, options: shuffled([item.term, ...distractors]) };
  });
}

export function gradeAnswer(item, response) {
  if (item.type === 'mc') {
    return Number(response) === Number(item.answerIndex);
  }
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[.!?]+$/, '');
  return norm(response) === norm(item.answer);
}

export function applyResult(progress, wordId, correct, dateStr) {
  const p = progressFor(progress, wordId);
  p.exposures += 1;
  p.lastSeen = dateStr;
  const wasMastered = p.mastered;
  if (correct) {
    p.correct += 1;
    p.streak += 1;
  } else {
    p.incorrect += 1;
    p.streak = 0;
  }
  p.mastered = p.streak >= MASTERY_STREAK;
  if (p.mastered && !wasMastered) p.masteredAt = dateStr;
  progress.words[wordId] = p;
  return { newlyMastered: p.mastered && !wasMastered };
}

// The user says they already know a word highlighted in today's article, so
// it's marked mastered outright (skipping the usual 3-correct-in-a-row climb)
// and dropped from today's quiz.
export function markWordKnown(progress, wordId, dateStr) {
  const p = progressFor(progress, wordId);
  p.exposures += 1;
  p.lastSeen = dateStr;
  p.streak = MASTERY_STREAK;
  p.mastered = true;
  p.masteredAt = dateStr;
  progress.words[wordId] = p;
}

export function summarize(progress, bank) {
  const entries = Object.entries(progress.words);
  const mastered = entries.filter(([, p]) => p.mastered).length;
  const inProgress = entries.filter(([, p]) => !p.mastered && p.exposures > 0).length;
  const byCategory = {};
  for (const w of bank) {
    byCategory[w.category] ||= { total: 0, mastered: 0 };
    byCategory[w.category].total += 1;
    const p = progress.words[w.id];
    if (p?.mastered) byCategory[w.category].mastered += 1;
  }
  return {
    totalWords: bank.length,
    mastered,
    inProgress,
    untouched: bank.length - mastered - inProgress,
    xp: progress.xp,
    streakDays: progress.streakDays,
    byCategory,
  };
}
