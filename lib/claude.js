const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

function stripFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

async function callClaude(system, user) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to your .env file.');
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data.content?.map((b) => b.text || '').join('') || '';
  return text;
}

function buildPrompt(words, story) {
  const wordList = words
    .map(
      (w, i) =>
        `${i + 1}. id="${w.id}" term="${w.term}" category=${w.category} quizType=${w.quizType} meaning="${w.definition}"`
    )
    .join('\n');

  const system = [
    'You write short news-style articles for an English vocabulary-learning app, and you design quiz questions for them.',
    'Output ONLY a single valid JSON object. No markdown code fences, no commentary before or after.',
  ].join(' ');

  const groundingBlock = story && !story.fallback
    ? `Base the article on this real, current ${story.topic} story from ${story.source} (published ${story.pubDate}):
Headline: "${story.title}"
Summary: "${story.description || '(no summary provided)'}"
Source link: ${story.link}

Write an ORIGINAL short article that reports on the same real story for an English learner audience. Summarize the facts in your own words — do not copy sentences verbatim from the headline or summary above, and do not invent facts that contradict them. You may open or close with a brief mention of the source (e.g. "according to ${story.source}").`
    : `Write an original, plausible-sounding ${story?.topic || 'technology'} news story for today (no real source is available right now, so keep it general and avoid naming specific real people, companies, or events as if they were confirmed facts).`;

  const user = `${groundingBlock}

Aim for 5-7 short paragraphs, 300-450 words, reading like a real, engaging news story (a byline-free article body, plain text, no markdown headings), suitable for an adult English learner.

You must naturally weave in ALL of the following ${words.length} vocabulary items, using the EXACT term text given (do not change its form, tense, or word order) at least once each, and wrap each occurrence the first time it appears in double asterisks like **term**:
${wordList}

Then produce one quiz question per vocabulary item, using the "quizType" specified for each:
- quizType "mc": a multiple-choice question asking what the term means AS USED in the article. Provide exactly 4 short answer options (plain strings, no "A)" prefixes), where exactly one is correct (matching the given meaning, may be paraphrased) and the other three are plausible but wrong definitions (do not reuse another target word's meaning). Give the 0-based index of the correct option.
- quizType "fill": a fill-in-the-blank sentence, either taken/adapted from the article or a new natural sentence using the same context, with the target term replaced by "_____". Do not include the answer anywhere else in that sentence.

Return exactly this JSON shape:
{
  "title": "string",
  "body": "string, paragraphs separated by \\n\\n",
  "quiz": [
    { "wordId": "string (copy from the list above)", "type": "mc", "question": "string", "options": ["string","string","string","string"], "answerIndex": 0 },
    { "wordId": "string (copy from the list above)", "type": "fill", "fillSentence": "string containing _____" }
  ]
}
The "quiz" array must have exactly ${words.length} items, one per vocabulary item above, in any order, each using its assigned quizType.`;

  return { system, user };
}

function validate(json, words) {
  if (!json || typeof json !== 'object') throw new Error('Model did not return an object');
  if (typeof json.title !== 'string' || typeof json.body !== 'string') {
    throw new Error('Missing title/body');
  }
  if (!Array.isArray(json.quiz) || json.quiz.length !== words.length) {
    throw new Error('Quiz array missing or wrong length');
  }
  const ids = new Set(words.map((w) => w.id));
  for (const item of json.quiz) {
    if (!ids.has(item.wordId)) throw new Error(`Unknown wordId in quiz: ${item.wordId}`);
    if (item.type === 'mc') {
      if (!Array.isArray(item.options) || item.options.length !== 4) {
        throw new Error('MC item needs 4 options');
      }
      if (
        typeof item.answerIndex !== 'number' ||
        item.answerIndex < 0 ||
        item.answerIndex > 3
      ) {
        throw new Error('MC item needs a valid answerIndex');
      }
    } else if (item.type === 'fill') {
      if (typeof item.fillSentence !== 'string' || !item.fillSentence.includes('_____')) {
        throw new Error('Fill item needs a fillSentence with a blank');
      }
    } else {
      throw new Error(`Unknown quiz item type: ${item.type}`);
    }
  }
  return json;
}

// Returns the American English IPA phonetic transcription for a term.
export async function getExample(term, definition) {
  const system = 'You are a concise English teacher. Respond with ONLY one short natural example sentence using the word in context. No commentary, no quotes around the sentence.';
  const user = `Write one natural example sentence using "${term}" (meaning: ${definition}). The word or phrase should appear in the sentence naturally.`;
  const raw = await callClaude(system, user);
  return raw.trim().replace(/^["']|["']$/g, '');
}

export async function getIPA(term) {
  const system = 'You are a phonetics expert. Respond with ONLY the IPA transcription enclosed in forward slashes, nothing else.';
  const user = `American English IPA transcription for: "${term}". Format: /ɪˈpɑː/`;
  const raw = await callClaude(system, user);
  const match = raw.trim().match(/\/[^/]+\//);
  return match ? match[0] : null;
}

// Generates a learner-friendly definition + example sentence for an arbitrary
// word or phrase the user adds to their favorites list.
export async function defineTerm(term) {
  const system = 'You are a concise English dictionary for language learners. Output ONLY a single valid JSON object, no markdown code fences, no commentary.';
  const user = `Give a learner-friendly definition and one natural example sentence for this English word or phrase: "${term}".
Return exactly this JSON shape:
{ "definition": "one short, clear sentence defining it", "example": "one natural example sentence using it, with the term wrapped in **double asterisks**" }`;

  const raw = await callClaude(system, user);
  const json = JSON.parse(stripFences(raw));
  if (typeof json.definition !== 'string' || typeof json.example !== 'string') {
    throw new Error(`Could not generate a definition for "${term}".`);
  }
  return json;
}

// `story` comes from lib/newsFeed.js: { topic, title, link, pubDate, description, source }
// or null if no live feed item could be fetched.
export async function generateArticle(words, story) {
  const { system, user } = buildPrompt(words, story);

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callClaude(
        system,
        attempt === 0 ? user : `${user}\n\nYour previous reply was invalid JSON or did not match the shape. Return ONLY the corrected JSON object this time.`
      );
      const json = JSON.parse(stripFences(raw));
      validate(json, words);

      // Attach the term and grading answer server-side so a fill item's answer
      // always matches the vocab bank exactly, regardless of model output.
      const wordById = new Map(words.map((w) => [w.id, w]));
      json.quiz = json.quiz.map((item) => {
        const w = wordById.get(item.wordId);
        if (item.type === 'fill') {
          return { ...item, term: w.term, answer: w.term };
        }
        return { ...item, term: w.term };
      });
      json.topic = story?.topic || 'technology';
      json.source = story && !story.fallback ? { name: story.source, link: story.link, pubDate: story.pubDate } : null;
      return json;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
