import { createContext, useContext } from 'react';

// Value shape while Today's live (unfinished) reading view is showing:
// { targetWords: [{ term, wordId }], skipWord(wordId) } — null otherwise
// (quiz step, results, or another tab active). Lets the global text-selection
// handler offer "I already know this" when the selection lands on a target word.
const ActiveQuizContext = createContext(null);

export const ActiveQuizProvider = ActiveQuizContext.Provider;

export function useActiveQuiz() {
  return useContext(ActiveQuizContext);
}
