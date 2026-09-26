import { useEffect } from 'react';
import { useFavorites } from '../context/FavoritesContext.jsx';
import { usePopover } from '../context/PopoverContext.jsx';
import { useActiveQuiz } from '../context/ActiveQuizContext.jsx';
import { StarIcon } from '../icons.jsx';

function normalizeSelection(raw) {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“‘.,:;!?]+|["'”’.,:;!?]+$/g, '');
}

// Selecting text inside any .article-body pops up a "+ Favorite" button near
// the selection — unless the selection lands on a live (interactive) target
// word, which instead offers "I already know this". Mounted once, globally.
export default function SelectionFavoriteHandler() {
  const { addFavorite } = useFavorites();
  const { show, update, hide, hideAfter } = usePopover();
  const activeQuiz = useActiveQuiz();

  useEffect(() => {
    const onMouseUp = (e) => {
      if (e.target.closest?.('.fav-popover')) return;
      if (e.target.closest?.('.fav-highlight')) return;
      if (e.target.closest?.('.target-word')) return; // handled by its own click

      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel && sel.rangeCount ? normalizeSelection(sel.toString()) : '';
        const anchor = sel?.anchorNode;
        const anchorEl = anchor && (anchor.nodeType === 3 ? anchor.parentElement : anchor);
        const container = anchorEl?.closest?.('.article-body');

        if (!text || text.length < 2 || text.length > 80 || !container) {
          hide();
          return;
        }

        const targetWordEl = anchorEl.closest('.target-word');
        if (targetWordEl && activeQuiz) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          show({
            rect,
            widthGuess: 170,
            content: '✓ I already know this',
            onClick: async () => {
              update({ disabled: true, content: 'Marking as known…' });
              try {
                await activeQuiz.skipWord(targetWordEl.dataset.wordId);
                update({ content: 'Marked as known ✓' });
              } catch (err) {
                update({ content: err.message || 'Couldn’t update' });
              }
              window.getSelection()?.removeAllRanges();
              hideAfter(1200);
            },
          });
          return;
        }

        const rect = sel.getRangeAt(0).getBoundingClientRect();
        show({
          rect,
          widthGuess: 32,
          title: 'Favorite',
          content: <StarIcon />,
          onClick: async () => {
            update({ disabled: true, content: 'Saving…' });
            try {
              const res = await addFavorite(text);
              update({ content: res.alreadyExists ? 'Already saved' : 'Saved ✓' });
            } catch {
              update({ content: 'Couldn’t save' });
            }
            window.getSelection()?.removeAllRanges();
            hideAfter(1200);
          },
        });
      }, 0);
    };

    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [addFavorite, show, update, hide, hideAfter, activeQuiz]);

  return null;
}
