import { useFavorites } from '../context/FavoritesContext.jsx';
import { usePopover } from '../context/PopoverContext.jsx';
import { StarFilledIcon } from '../icons.jsx';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Wraps every favorite term found in `text` in a `.fav-highlight` span,
// clicking which offers to unfavorite it. Longest terms match first so a
// shorter favorite can't shadow a longer one that contains it.
function highlightFavorites(text, favorites, keyPrefix) {
  if (!favorites.length || !text) return [text];
  const byLower = new Map(favorites.map((f) => [f.term.toLowerCase(), f]));
  const terms = [...byLower.keys()].sort((a, b) => b.length - a.length).map(escapeRegex);
  if (!terms.length) return [text];
  const pattern = new RegExp(`(?:${terms.join('|')})`, 'gi');

  const nodes = [];
  let lastIndex = 0;
  let match;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const favorite = byLower.get(match[0].toLowerCase());
    nodes.push(
      <FavHighlight key={`${keyPrefix}-${i++}`} favorite={favorite}>
        {match[0]}
      </FavHighlight>
    );
    lastIndex = match.index + match[0].length;
    if (match[0].length === 0) pattern.lastIndex += 1;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function FavHighlight({ favorite, children }) {
  const { removeFavorite } = useFavorites();
  const { show, update, hideAfter } = usePopover();

  const handleClick = (e) => {
    e.stopPropagation();
    show({
      rect: e.currentTarget.getBoundingClientRect(),
      widthGuess: 32,
      title: 'Unfavorite',
      content: <StarFilledIcon />,
      onClick: async () => {
        update({ disabled: true, content: 'Removing…' });
        try {
          await removeFavorite(favorite.id);
          update({ content: 'Removed' });
        } catch {
          update({ content: "Couldn't remove" });
        }
        hideAfter(900);
      },
    });
  };

  return (
    <span className="fav-highlight" onClick={handleClick}>
      {children}
    </span>
  );
}

function TargetWord({ wordId, children, onWordClick }) {
  const handleClick = (e) => {
    e.stopPropagation();
    onWordClick(wordId, e.currentTarget.getBoundingClientRect());
  };
  return (
    <strong className="target-vocab target-word" data-word-id={wordId} onClick={handleClick}>
      {children}
    </strong>
  );
}

// Renders an article body: `**bold**` markers become <strong>, ones matching
// a day's quiz word get a `.target-vocab` highlight (clickable "I already
// know this" when `interactive`), and any favorited term found in the plain
// text gets a `.fav-highlight` (clickable "Unfavorite").
export default function ArticleBody({ body, targetWords = [], interactive = false, onSkipWord }) {
  const { favorites } = useFavorites();
  const { show, update, hideAfter } = usePopover();

  const handleWordClick = (wordId, rect) => {
    const label = interactive ? '✓ I already know this' : '✕ Remove highlight';
    show({
      rect,
      widthGuess: 170,
      content: label,
      onClick: async () => {
        update({ disabled: true, content: interactive ? 'Marking as known…' : 'Removing…' });
        try {
          await onSkipWord(wordId);
          update({ content: interactive ? 'Marked as known ✓' : 'Removed ✓' });
        } catch (err) {
          update({ content: err.message || 'Couldn\'t update' });
        }
        window.getSelection()?.removeAllRanges();
        hideAfter(1200);
      },
    });
  };

  const byLower = new Map(targetWords.map((w) => [w.term.toLowerCase(), w.wordId]));

  const paragraphs = body.split('\n\n').map((para, pi) => {
    const parts = para.split(/(\*\*.+?\*\*)/g);
    const nodes = parts.map((part, idx) => {
      const m = part.match(/^\*\*(.+)\*\*$/);
      if (m) {
        const inner = m[1];
        const wordId = byLower.get(inner.toLowerCase());
        if (wordId && onSkipWord) {
          return (
            <TargetWord key={idx} wordId={wordId} onWordClick={handleWordClick}>
              {inner}
            </TargetWord>
          );
        }
        return (
          <strong key={idx} className={wordId ? 'target-vocab' : undefined}>
            {inner}
          </strong>
        );
      }
      return <span key={idx}>{highlightFavorites(part, favorites, `${pi}-${idx}`)}</span>;
    });
    return <p key={pi}>{nodes}</p>;
  });

  return <div className="article-body">{paragraphs}</div>;
}
