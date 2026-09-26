# Vocab News

Learn idioms, SAT vocabulary, and common American phrases through one AI-generated news article a day. Each article is tested with a mix of multiple-choice and fill-in-the-blank questions; your scores decide which words come back for review and which new ones get introduced next.

The frontend is a Vite + React app (`src/`); `server.js` is a small Node API backend (no framework) that also serves the built frontend in production.

## Setup

1. Copy the env file and add your Anthropic API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and set `ANTHROPIC_API_KEY=sk-ant-...`.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start development (runs the API server on :5175 and the Vite dev server on :5173, with API requests proxied):

   ```bash
   npm run dev
   ```

   Open http://localhost:5173 in your browser. Edits to `src/` hot-reload instantly.

### Production

```bash
npm run build   # builds the React app into dist/
npm start       # serves dist/ + the API from a single process on :5175
```

## How it works

- **One article per day.** The first time you open the app each day, the server picks a batch of vocabulary words (idioms, SAT words, common American phrases), sends them to Claude, and gets back a short news article that naturally uses every word, plus one quiz question per word. The same article is served for the rest of the day.
- **Adaptive selection.** Words you've seen but haven't mastered yet are prioritized for review; the rest of each day's article is filled with brand-new words. A word is "mastered" after 3 correct answers in a row.
- **Quiz.** Each word is tested with either a multiple-choice "what does this mean here?" question or a fill-in-the-blank sentence. Scores, XP, and a daily streak are tracked and stored locally in `data/`.
- **Progress tab.** Shows mastered/in-progress/untouched word counts, mastery by category, and your quiz history.

All progress is stored as JSON files in `data/` (created automatically) — no database or account needed. Delete that folder to reset progress.
