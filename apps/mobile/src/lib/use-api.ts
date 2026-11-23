import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { api, errorMessage } from './api';

/** GETs `path` whenever the screen gains focus. Pass null to skip. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!path) return;
      const id = ++latest.current;
      if (isRefresh) setRefreshing(true);
      try {
        const result = await api.get<T>(path);
        if (id === latest.current) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (id === latest.current) setError(errorMessage(e));
      } finally {
        if (id === latest.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [path],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { data, setData, error, loading, refreshing, reload: () => load(true) };
}
