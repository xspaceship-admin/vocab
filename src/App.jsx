import { useState, useEffect } from 'react';

import Topbar, { BottomTabs } from './components/Topbar.jsx';
import StatsSheet from './components/StatsSheet.jsx';
import ArchiveView from './components/ArchiveTab/ArchiveView.jsx';
import WordBankTab from './components/WordBankTab/index.jsx';
import ProgressTab from './components/ProgressTab.jsx';
import SelectionFavoriteHandler from './components/SelectionFavoriteHandler.jsx';
import { FavoritesProvider } from './context/FavoritesContext.jsx';
import { StatsProvider } from './context/StatsContext.jsx';
import { PopoverProvider } from './context/PopoverContext.jsx';
import { ActiveQuizProvider } from './context/ActiveQuizContext.jsx';

const TABS = ['archive', 'favorites', 'progress'];

function tabFromHash() {
  const hash = window.location.hash.slice(1);
  if (hash === 'today') return 'archive'; // redirect old bookmarks
  return TABS.includes(hash) ? hash : 'archive';
}

export default function App() {
  const [tab, setTabState] = useState(tabFromHash);
  const [newArticleRequestId, setNewArticleRequestId] = useState(0);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [statsSheetOpen, setStatsSheetOpen] = useState(false);
  const [wbModalOpen, setWbModalOpen] = useState(false);
  const [wbFiltersOpen, setWbFiltersOpen] = useState(false);
  const [wbFilterCount, setWbFilterCount] = useState(1);

  const setTab = (t) => {
    setTabState(t);
    window.location.hash = t;
  };

  useEffect(() => {
    const onHashChange = () => setTabState(tabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleNewArticle = () => {
    setTab('archive');
    setNewArticleRequestId((n) => n + 1);
  };

  return (
    <FavoritesProvider>
      <StatsProvider>
        <PopoverProvider>
          <ActiveQuizProvider value={activeQuiz}>
            <Topbar
              tab={tab}
              onTabChange={setTab}
              onNewArticle={handleNewArticle}
              onOpenStats={() => setStatsSheetOpen(true)}
              onAddWord={() => setWbModalOpen(true)}
              onOpenFilters={() => setWbFiltersOpen(true)}
              wbFilterCount={wbFilterCount}
            />
            <main className="app">
              {/* ArchiveView stays mounted so the "New article" button reaches TodayTab from any tab */}
              <div className={tab === 'archive' ? '' : 'hidden'}>
                <ArchiveView
                  newArticleRequestId={newArticleRequestId}
                  onActiveQuizChange={setActiveQuiz}
                  onGoToProgress={() => setTab('progress')}
                />
              </div>
              {tab === 'favorites' && (
                <WordBankTab
                  modalOpen={wbModalOpen}
                  onOpenModal={() => setWbModalOpen(true)}
                  onCloseModal={() => setWbModalOpen(false)}
                  filtersOpen={wbFiltersOpen}
                  onCloseFilters={() => setWbFiltersOpen(false)}
                  onFilterCountChange={setWbFilterCount}
                />
              )}
              {tab === 'progress' && <ProgressTab />}
            </main>
            <BottomTabs tab={tab} onTabChange={setTab} />
            <StatsSheet open={statsSheetOpen} onClose={() => setStatsSheetOpen(false)} />
            <SelectionFavoriteHandler />
          </ActiveQuizProvider>
        </PopoverProvider>
      </StatsProvider>
    </FavoritesProvider>
  );
}
