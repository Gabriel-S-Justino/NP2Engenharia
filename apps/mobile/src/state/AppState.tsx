import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ApiError, api, errorMessage, setAdminToken } from '@/services/api';
import { readValue, writeValue } from '@/services/storage';
import type { ChatFilters, ChatResponse, Health } from '@/types/api';
import { CONVERSATIONS_KEY, parseConversations, rememberConversation, type SavedConversation } from '@/utils/conversations';

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
  conversations: SavedConversation[];
  entries: ChatEntry[];
  sending: boolean;
  historyLoading: boolean;
  historyError: string | null;
  openConversation: (id: string) => Promise<boolean>;
  newConversation: () => void;
  ask: (question: string, filters?: ChatFilters) => Promise<void>;
  retry: (entryId: string) => Promise<void>;
  clearConversation: () => Promise<void>;
};

const AppStateContext = createContext<AppStateValue | null>(null);

function newConversationId() {
  return `conv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}${Math.random().toString(36).slice(2, 14)}`;
}

async function readHistory(id: string): Promise<ChatResponse[]> {
  const items: ChatResponse[] = [];
  let more = true;
  while (more) {
    const page = await api.chatHistory(id, items.length);
    items.push(...page.items);
    more = !!page.has_more && page.items.length > 0;
  }
  return items;
}

function toEntries(items: ChatResponse[]): ChatEntry[] {
  return items.map((response) => ({ id: response.interaction_id, kind: 'answer', question: response.question, response }));
}

/** A lista pertence ao dispositivo; as mensagens e fontes continuam armazenadas no servidor. */
export function AppStateProvider({ children, pollMs = 30_000 }: { children: ReactNode; pollMs?: number }) {
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [health, setHealth] = useState<Health | null>(null);
  const [lastHealthCheck, setLastHealthCheck] = useState<string | null>(null);
  const [adminToken, setToken] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const historyBusy = useRef(true);
  const conversationRef = useRef<string | null>(null);
  const conversationsRef = useRef<SavedConversation[]>([]);
  const writes = useRef<Promise<void>>(Promise.resolve());

  // Serializa as gravações para uma resposta antiga não sobrescrever a seleção mais recente.
  const persist = useCallback((key: string, value: string | null) => {
    writes.current = writes.current.then(() => writeValue(key, value));
  }, []);

  const updateConversations = useCallback((list: SavedConversation[]) => {
    conversationsRef.current = list;
    setConversations(list);
    persist(CONVERSATIONS_KEY, JSON.stringify(list));
  }, [persist]);

  const selectConversation = useCallback((id: string, items: ChatResponse[]) => {
    conversationRef.current = id;
    setConversationId(id);
    setEntries(toEntries(items));
    persist('conversation-id', id);
  }, [persist]);

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

  useEffect(() => {
    let active = true;
    (async () => {
      const [token, conv, saved] = await Promise.all([
        readValue('admin-token'), readValue('conversation-id'), readValue(CONVERSATIONS_KEY),
      ]);
      if (!active) return;
      setToken(token);
      setAdminToken(token);
      const list = parseConversations(saved);
      conversationsRef.current = list;
      setConversations(list);
      const id = conv ?? newConversationId();
      conversationRef.current = id;
      setConversationId(id);
      try {
        const items = await readHistory(id);
        if (!active) return;
        selectConversation(id, items);
        updateConversations(rememberConversation(list, id, items));
      } catch {
        if (active) {
          // Mantém o identificador legado recuperável mesmo quando o servidor está offline.
          if (conv && !list.some((c) => c.id === conv)) {
            updateConversations([{ id: conv, title: 'Conversa anterior', updatedAt: new Date().toISOString() }, ...list]);
          }
          setHistoryError('Não foi possível carregar esta conversa. Tente abri-la novamente pelo histórico.');
        }
      } finally {
        if (active) {
          historyBusy.current = false;
          setHistoryLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, [selectConversation, updateConversations]);

  const saveAdminToken = useCallback(async (token: string | null) => {
    const value = token && token.trim() ? token.trim() : null;
    setToken(value);
    setAdminToken(value);
    await writeValue('admin-token', value);
  }, []);

  const openConversation = useCallback(async (id: string) => {
    if (sendingRef.current || historyBusy.current || (id !== conversationRef.current && !conversationsRef.current.some((c) => c.id === id))) return false;
    historyBusy.current = true;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const items = await readHistory(id);
      selectConversation(id, items);
      updateConversations(rememberConversation(conversationsRef.current, id, items));
      return true;
    } catch {
      setHistoryError('Não foi possível abrir a conversa. Suas mensagens atuais foram mantidas. Tente novamente.');
      return false;
    } finally {
      historyBusy.current = false;
      setHistoryLoading(false);
    }
  }, [selectConversation, updateConversations]);

  const newConversation = useCallback(() => {
    if (sendingRef.current || historyBusy.current) return;
    selectConversation(newConversationId(), []);
    setHistoryError(null);
  }, [selectConversation]);

  const runQuestion = useCallback(async (entryId: string, question: string, filters?: ChatFilters) => {
    if (sendingRef.current || historyBusy.current || !conversationRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const id = conversationRef.current;
    try {
      const response = await api.chat({ question, conversation_id: id, filters });
      setEntries((list) => list.map((e) => (e.id === entryId ? { id: entryId, kind: 'answer', question, response } : e)));
      updateConversations(rememberConversation(conversationsRef.current, id, [response]));
    } catch (err) {
      const retryable = err instanceof ApiError ? err.retryable : true;
      setEntries((list) => list.map((e) => (
        e.id === entryId ? { id: entryId, kind: 'error', question, message: errorMessage(err), retryable } : e
      )));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [updateConversations]);

  const ask = useCallback(async (question: string, filters?: ChatFilters) => {
    const trimmed = question.trim();
    if (!trimmed || sendingRef.current || historyBusy.current || !conversationRef.current || historyError) return;
    const id = `local_${Date.now().toString(36)}`;
    setEntries((list) => [...list, { id, kind: 'pending', question: trimmed }]);
    await runQuestion(id, trimmed, filters);
  }, [runQuestion, historyError]);

  const retry = useCallback(async (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || entry.kind !== 'error' || sendingRef.current || historyBusy.current || historyError) return;
    setEntries((list) => list.map((e) => (e.id === entryId ? { id: entryId, kind: 'pending', question: entry.question } : e)));
    await runQuestion(entryId, entry.question);
  }, [entries, runQuestion, historyError]);

  const clearConversation = useCallback(async () => {
    if (!conversationRef.current || sendingRef.current || historyBusy.current) return;
    const id = conversationRef.current;
    historyBusy.current = true;
    setHistoryLoading(true);
    try {
      await api.clearChat(id);
      updateConversations(conversationsRef.current.filter((c) => c.id !== id));
      selectConversation(newConversationId(), []);
      setHistoryError(null);
    } catch {
      setHistoryError('Não foi possível apagar a conversa no servidor. Ela continua salva. Tente novamente.');
    } finally {
      historyBusy.current = false;
      setHistoryLoading(false);
    }
  }, [selectConversation, updateConversations]);

  const value = useMemo(() => ({
    connection, health, lastHealthCheck, refreshHealth, adminToken, saveAdminToken,
    conversationId, conversations, entries, sending, historyLoading, historyError,
    openConversation, newConversation, ask, retry, clearConversation,
  }), [connection, health, lastHealthCheck, refreshHealth, adminToken, saveAdminToken,
    conversationId, conversations, entries, sending, historyLoading, historyError,
    openConversation, newConversation, ask, retry, clearConversation]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState deve ser usado dentro de AppStateProvider');
  return ctx;
}
