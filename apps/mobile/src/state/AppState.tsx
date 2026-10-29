import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ApiError, api, errorMessage, setAdminToken } from '@/services/api';
import { readValue, writeValue } from '@/services/storage';
import type { ChatFilters, ChatResponse, Health } from '@/types/api';

export type ConnectionState = 'checking' | 'online' | 'degraded' | 'offline';

export type ChatEntry =
  | { id: string; kind: 'pending'; question: string }
  | { id: string; kind: 'answer'; question: string; response: ChatResponse }
  | { id: string; kind: 'error'; question: string; message: string; retryable: boolean };

type AppStateValue = {
  connection: ConnectionState;
  health: Health | null;
  lastHealthCheck: string | null;
  refreshHealth: () => Promise<void>;
  adminToken: string | null;
  saveAdminToken: (token: string | null) => Promise<void>;
  conversationId: string | null;
  entries: ChatEntry[];
  sending: boolean;
  historyLoading: boolean;
  ask: (question: string, filters?: ChatFilters) => Promise<void>;
  retry: (entryId: string) => Promise<void>;
  clearConversation: () => Promise<void>;
};

const AppStateContext = createContext<AppStateValue | null>(null);

function newConversationId() {
  return `conv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Estado global: conexão com o backend, token administrativo e conversa atual (preservada entre telas). */
export function AppStateProvider({ children, pollMs = 30_000 }: { children: ReactNode; pollMs?: number }) {
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [health, setHealth] = useState<Health | null>(null);
  const [lastHealthCheck, setLastHealthCheck] = useState<string | null>(null);
  const [adminToken, setToken] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const sendingRef = useRef(false);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await api.health();
      setHealth(h);
      setConnection(h.status === 'ok' ? 'online' : 'degraded');
    } catch {
      setHealth(null);
      setConnection('offline');
    } finally {
      setLastHealthCheck(new Date().toISOString());
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    if (!pollMs) return;
    const timer = setInterval(() => void refreshHealth(), pollMs);
    return () => clearInterval(timer);
  }, [refreshHealth, pollMs]);

  // Restaura token e conversa salvos no dispositivo.
  useEffect(() => {
    let active = true;
    (async () => {
      const [token, conv] = await Promise.all([readValue('admin-token'), readValue('conversation-id')]);
      if (!active) return;
      setToken(token);
      setAdminToken(token);
      const id = conv ?? newConversationId();
      setConversationId(id);
      if (!conv) await writeValue('conversation-id', id);
      try {
        const history = await api.chatHistory(id);
        if (active) {
          setEntries(history.items.map((r) => ({ id: r.interaction_id, kind: 'answer', question: r.question, response: r })));
        }
      } catch {
        // histórico indisponível (ex.: backend offline): a conversa começa vazia
      } finally {
        if (active) setHistoryLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveAdminToken = useCallback(async (token: string | null) => {
    const value = token && token.trim() ? token.trim() : null;
    setToken(value);
    setAdminToken(value);
    await writeValue('admin-token', value);
  }, []);

  const runQuestion = useCallback(
    async (entryId: string, question: string, filters?: ChatFilters) => {
      // Impede envios duplicados enquanto uma pergunta está em processamento.
      if (sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);
      try {
        const response = await api.chat({ question, conversation_id: conversationId ?? undefined, filters });
        setEntries((list) => list.map((e) => (e.id === entryId ? { id: entryId, kind: 'answer', question, response } : e)));
      } catch (err) {
        const retryable = err instanceof ApiError ? err.retryable : true;
        setEntries((list) =>
          list.map((e) => (e.id === entryId ? { id: entryId, kind: 'error', question, message: errorMessage(err), retryable } : e)),
        );
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [conversationId],
  );

  const ask = useCallback(
    async (question: string, filters?: ChatFilters) => {
      const trimmed = question.trim();
      if (!trimmed || sendingRef.current) return;
      const id = `local_${Date.now().toString(36)}`;
      setEntries((list) => [...list, { id, kind: 'pending', question: trimmed }]);
      await runQuestion(id, trimmed, filters);
    },
    [runQuestion],
  );

  const retry = useCallback(
    async (entryId: string) => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry || entry.kind !== 'error' || sendingRef.current) return;
      setEntries((list) => list.map((e) => (e.id === entryId ? { id: entryId, kind: 'pending', question: entry.question } : e)));
      await runQuestion(entryId, entry.question);
    },
    [entries, runQuestion],
  );

  const clearConversation = useCallback(async () => {
    if (conversationId) {
      try {
        await api.clearChat(conversationId);
      } catch {
        // mesmo sem backend, limpa a conversa local
      }
    }
    const id = newConversationId();
    setConversationId(id);
    setEntries([]);
    await writeValue('conversation-id', id);
  }, [conversationId]);

  const value = useMemo(
    () => ({
      connection,
      health,
      lastHealthCheck,
      refreshHealth,
      adminToken,
      saveAdminToken,
      conversationId,
      entries,
      sending,
      historyLoading,
      ask,
      retry,
      clearConversation,
    }),
    [connection, health, lastHealthCheck, refreshHealth, adminToken, saveAdminToken, conversationId, entries, sending, historyLoading, ask, retry, clearConversation],
  );
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState deve ser usado dentro de AppStateProvider');
  return ctx;
}
