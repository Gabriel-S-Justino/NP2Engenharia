import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/services/api';

export type AsyncState<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (value: T | null) => void;
};

/** Carrega dados de forma assíncrona com estados de carregamento, erro e recarga. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = [], options: { enabled?: boolean } = {}): AsyncState<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(enabled);
  const mounted = useRef(true);
  const loaderRef = useRef(loader);
  const requestId = useRef(0);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await loaderRef.current();
      // Ignora respostas de requisições antigas (ex.: digitação rápida na busca).
      if (!mounted.current || id !== requestId.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (!mounted.current || id !== requestId.current) return;
      setError(err instanceof ApiError ? err : new ApiError('Ocorreu um erro inesperado.', 'network'));
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Agenda a carga fora do corpo do efeito (evita renderizações em cascata).
    if (enabled) queueMicrotask(() => void reload());
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, error, loading, reload, setData };
}
