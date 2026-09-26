import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// A single floating action button shared by every "+ Favorite" / "Unfavorite"
// / "I already know this" prompt in the app, positioned next to whatever
// selection/word triggered it. Only one can be open at a time.
const PopoverContext = createContext(null);

export function PopoverProvider({ children }) {
  const [popover, setPopover] = useState(null);
  const hideTimer = useRef(null);
  const elRef = useRef(null);

  const hide = useCallback(() => {
    clearTimeout(hideTimer.current);
    setPopover(null);
  }, []);

  const show = useCallback((opts) => {
    clearTimeout(hideTimer.current);
    setPopover({ disabled: false, ...opts });
  }, []);

  const update = useCallback((patch) => {
    setPopover((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const hideAfter = useCallback(
    (ms) => {
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hide, ms);
    },
    [hide]
  );

  useEffect(() => {
    const onMouseDown = (e) => {
      if (elRef.current && elRef.current.contains(e.target)) return;
      hide();
    };
    const onScroll = () => hide();
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [hide]);

  return (
    <PopoverContext.Provider value={{ show, hide, update, hideAfter }}>
      {children}
      {popover && (
        <button
          ref={elRef}
          className="fav-popover"
          disabled={popover.disabled}
          title={popover.title}
          style={{
            left: `${window.scrollX + popover.rect.left + popover.rect.width / 2 - popover.widthGuess / 2}px`,
            top: `${window.scrollY + popover.rect.top - 38}px`,
          }}
          onClick={popover.onClick}
        >
          {popover.content}
        </button>
      )}
    </PopoverContext.Provider>
  );
}

export function usePopover() {
  return useContext(PopoverContext);
}
