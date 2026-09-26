import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import { useFavorites } from '../../context/FavoritesContext.jsx';
import WordCard from './WordCard.jsx';
import AddWordModal from './AddWordModal.jsx';

const WORD_BANK_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'favorite', label: 'Favorites' },
  { key: 'idiom', label: 'Idioms' },
  { key: 'sat', label: 'SAT Words' },
  { key: 'phrase', label: 'Phrases' },
  { key: 'concept', label: 'Concepts' },
];

const WORD_BANK_STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'mastered', label: 'Mastered' },
  { key: 'not-mastered', label: 'Not Mastered' },
  { key: 'archived', label: 'Archived' },
];

function FilterSection({ title, options, value, onChange }) {
  return (
    <div className="wordbank-nav-section">
      <h3 className="defs-panel-title">{title}</h3>
      <div className="wordbank-filter-list">
        {options.map((o) => (
          <button
            key={o.key}
            className={`wordbank-filter-btn${value === o.key ? ' active' : ''}`}
            onClick={() => onChange(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Shows every favorite (always, even untested) plus every built-in bank word
// that has come up in a quiz at least once. A left sidebar lets you search
// it, filter by type/status, and sort it.
export default function WordBankTab() {
  const { removeFavorite } = useFavorites();
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('not-mastered');
  const [sort, setSort] = useState('memory');
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { words } = await api('/api/wordbank');
      setWords(words);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const search = searchInput.trim().toLowerCase();

  const filtered = useMemo(() => {
    let list = words;
    const showingArchived = status === 'archived';
    list = list.filter((w) => !!w.archived === showingArchived);
    if (category !== 'all') list = list.filter((w) => w.category === category);
    if (!showingArchived && status !== 'all') {
      const wantMastered = status === 'mastered';
      list = list.filter((w) => !!w.progress?.mastered === wantMastered);
    }
    if (search) list = list.filter((w) => w.term.toLowerCase().includes(search));
    return [...list].sort((a, b) => {
      if (sort === 'difficulty') {
        return (a.difficulty ?? 0) - (b.difficulty ?? 0) || a.term.localeCompare(b.term);
      }
      if (sort === 'memory') {
        const streakA = a.progress?.mastered ? 999 : (a.progress?.streak ?? 0);
        const streakB = b.progress?.mastered ? 999 : (b.progress?.streak ?? 0);
        return streakA - streakB || (b.progress?.exposures ?? 0) - (a.progress?.exposures ?? 0) || a.term.localeCompare(b.term);
      }
      if (sort === 'newest') {
        const dateA = a.addedAt || a.progress?.lastSeen || '';
        const dateB = b.addedAt || b.progress?.lastSeen || '';
        return dateB.localeCompare(dateA) || a.term.localeCompare(b.term);
      }
      return a.term.localeCompare(b.term);
    });
  }, [words, category, status, search, sort]);

  const handleRemove = async (id) => {
    await removeFavorite(id);
    setWords((prev) => prev.filter((w) => w.id !== id));
  };

  const handleArchive = async (id, archive) => {
    await api('/api/wordbank/archive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wordId: id, archive }),
    });
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, archived: archive } : w)));
  };

  return (
    <div className="wordbank-layout">
      <aside className="wordbank-nav">
        <div className="wordbank-nav-section">
          <button className="nav-btn" style={{ width: '100%' }} onClick={() => setModalOpen(true)}>
            Add a word
          </button>
        </div>
        <div className="wordbank-nav-section">
          <input
            className="fill-input"
            placeholder="Search word bank…"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--ink)', fontSize: 'var(--fs-sm)' }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <FilterSection title="Type" options={WORD_BANK_CATEGORIES} value={category} onChange={setCategory} />
        <FilterSection title="Status" options={WORD_BANK_STATUSES} value={status} onChange={setStatus} />
        <div className="wordbank-nav-section">
          <h3 className="defs-panel-title">Sort by</h3>
          <div className="wordbank-filter-list">
            <button className={`wordbank-filter-btn${sort === 'memory' ? ' active' : ''}`} onClick={() => setSort('memory')}>
              Least remembered
            </button>
            <button className={`wordbank-filter-btn${sort === 'alpha' ? ' active' : ''}`} onClick={() => setSort('alpha')}>
              A–Z
            </button>
            <button className={`wordbank-filter-btn${sort === 'difficulty' ? ' active' : ''}`} onClick={() => setSort('difficulty')}>
              Difficulty
            </button>
            <button className={`wordbank-filter-btn${sort === 'newest' ? ' active' : ''}`} onClick={() => setSort('newest')}>
              Newest
            </button>
          </div>
        </div>
      </aside>
      <div className="wordbank-main">
        {loading && <div className="spinner" />}
        {error && <div className="card error-box">{error.message}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="card center" style={{ color: 'var(--muted)' }}>
            {words.length ? 'No words match your search or filter.' : 'No words yet — add one above, or come back after today’s quiz.'}
          </div>
        )}
        {!loading && !error && filtered.map((w) => <WordCard key={w.id} word={w} onRemove={handleRemove} onArchive={handleArchive} />)}
      </div>
      <AddWordModal open={modalOpen} onClose={() => setModalOpen(false)} onAdded={load} />
    </div>
  );
}
