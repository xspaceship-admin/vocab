import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    api('/api/favorites')
      .then(({ favorites }) => setFavorites(favorites))
      .catch(() => {
        /* non-fatal */
      });
  }, []);

  const addFavorite = useCallback(async (term) => {
    const res = await api('/api/favorites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ term }),
    });
    setFavorites((prev) => (prev.some((f) => f.id === res.favorite.id) ? prev : [...prev, res.favorite]));
    return res;
  }, []);

  const removeFavorite = useCallback(async (id) => {
    await api(`/api/favorites/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return (
    <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
