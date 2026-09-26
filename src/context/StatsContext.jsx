import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const StatsContext = createContext(null);

export function StatsProvider({ children }) {
  const [summary, setSummary] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const stats = await api('/api/stats');
      setSummary(stats.summary);
      return stats;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <StatsContext.Provider value={{ summary, refresh }}>{children}</StatsContext.Provider>;
}

export function useStats() {
  return useContext(StatsContext);
}
