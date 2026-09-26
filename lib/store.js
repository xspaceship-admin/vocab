import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve('data');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function readJson(name, fallback) {
  ensureDir();
  const p = filePath(name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(name, data) {
  ensureDir();
  writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

export function todayStr() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function yesterdayStr(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const DEFAULT_PROGRESS = { words: {}, xp: 0, streakDays: 0, lastActiveDate: null };
export const DEFAULT_STATE = {
  lastArticleDate: null,
  currentArticle: null, // full article incl. answers, server-side only
  completedToday: false,
  results: null,
  regenCount: 0,
};
