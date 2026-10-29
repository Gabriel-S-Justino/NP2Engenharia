import { useCallback, useEffect, useRef, useState } from 'react';

import { api, errorMessage } from '@/services/api';
import type { IngestionStatus } from '@/types/api';

/** Acompanha a indexação no backend (polling enquanto houver execução em andamento). */
export function useIngestion(onFinished?: () => void) {
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasRunning = useRef(false);
  const finishedRef = useRef(onFinished);

  useEffect(() => {
    finishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.ingestionStatus();
        if (cancelled) return;
        setStatus(s);
        setError(null);
        if (s.running) {
          wasRunning.current = true;
          timer.current = setTimeout(() => setTick((t) => t + 1), 1500);
        } else if (wasRunning.current) {
          wasRunning.current = false;
          finishedRef.current?.();
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const track = useCallback(() => {
    wasRunning.current = true;
    setTick((t) => t + 1);
  }, []);

  return { status, error, refresh, track };
}
