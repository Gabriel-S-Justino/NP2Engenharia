import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ApiError, api, errorMessage, setAdminToken } from '@/services/api';
import { readValue, writeValue } from '@/services/storage';
import { useAuth } from '@/state/AuthState';
import type { ChatFilters, ChatResponse, Health } from '@/types/api';
import { CONVERSATIONS_KEY, parseConversations, type SavedConversation } from '@/utils/conversations';

export type ConnectionState = 'checking' | 'online' | 'degraded' | 'offline';
export type ChatEntry =
  | { id: string; kind: 'pending'; question: string }
  | { id: string; kind: 'answer'; question: string; response: ChatResponse }
  | { id: string; kind: 'error'; question: string; message: string; retryable: boolean };

type AppStateValue = {
  connection: ConnectionState; health: Health | null; lastHealthCheck: string | null;
  refreshHealth: () => Promise<void>; adminToken: string | null; saveAdminToken: (token: string | null) => Promise<void>;
  conversationId: string | null; conversations: SavedConversation[]; entries: ChatEntry[];
  sending: boolean; historyLoading: boolean; historyError: string | null;
  openConversation: (id: string) => Promise<boolean>; newConversation: () => void;
  ask: (question: string, filters?: ChatFilters) => Promise<void>; retry: (entryId: string) => Promise<void>;
  clearConversation: () => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  importLegacy: () => Promise<number>; legacyCount: number;
};
const AppStateContext = createContext<AppStateValue | null>(null);

function newId() { return `conv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}${Math.random().toString(36).slice(2, 14)}`; }
async function readHistory(id: string): Promise<ChatResponse[]> {
  const items: ChatResponse[] = [];
  while (true) {
    const page = await api.chatHistory(id, items.length);
    items.push(...page.items);
    if (!page.has_more || !page.items.length) return items;
  }
}
async function readCatalog(): Promise<SavedConversation[]> {
  const result: SavedConversation[] = [];
  while (true) {
    const page = await api.conversations(result.length);
    result.push(...page.items.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at })));
    if (!page.has_more || !page.items.length) return result;
  }
}
function toEntries(items: ChatResponse[]): ChatEntry[] {
  return items.map((response) => ({ id: response.interaction_id, kind: 'answer', question: response.question, response }));
}

export function AppStateProvider({ children, pollMs = 30_000 }: { children: ReactNode; pollMs?: number }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
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
  const [legacyIds, setLegacyIds] = useState<string[]>([]);
  const sendingRef = useRef(false);
  const historyBusy = useRef(true);
  const conversationRef = useRef<string | null>(null);
  const epoch = useRef(0);
  const writes = useRef<Promise<void>>(Promise.resolve());

  const persist = useCallback((key: string, value: string | null) => {
    writes.current = writes.current.then(() => writeValue(key, value));
  }, []);
  const select = useCallback((id: string, items: ChatResponse[]) => {
    conversationRef.current = id;
    setConversationId(id);
    setEntries(toEntries(items));
    if (userId) persist('conversation-id:' + userId, id);
  }, [persist, userId]);
  const refreshHealth = useCallback(async () => {
    try {
      const h = await api.health();
      setHealth(h); setConnection(h.status === 'ok' ? 'online' : 'degraded');
    } catch { setHealth(null); setConnection('offline'); }
    finally { setLastHealthCheck(new Date().toISOString()); }
  }, []);
  useEffect(() => {
    void refreshHealth();
    if (!pollMs) return;
    const timer = setInterval(() => void refreshHealth(), pollMs);
    return () => clearInterval(timer);
  }, [refreshHealth, pollMs]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [legacy, legacyId] = await Promise.all([readValue(CONVERSATIONS_KEY), readValue('conversation-id')]);
      if (!alive) return;
      setLegacyIds([...new Set([...parseConversations(legacy).map((c) => c.id), ...(legacyId ? [legacyId] : [])])]);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const version = ++epoch.current;
    historyBusy.current = true;
    sendingRef.current = false;
    setAdminToken(null);
    void (async () => {
      await Promise.resolve();
      if (version !== epoch.current) return;
      setEntries([]); setConversations([]); setSending(false); setHistoryError(null); setToken(null);
      conversationRef.current = null; setConversationId(null);
      setHistoryLoading(true);
      if (authLoading) return;
      if (!userId) { historyBusy.current = false; setHistoryLoading(false); return; }
      try {
        const [catalog, savedId, token] = await Promise.all([readCatalog(), readValue('conversation-id:' + userId), readValue('admin-token:' + userId)]);
        if (version !== epoch.current) return;
        setConversations(catalog); setToken(token); setAdminToken(token);
        const id = catalog.some((c) => c.id === savedId) ? savedId! : catalog[0]?.id ?? newId();
        const items = catalog.some((c) => c.id === id) ? await readHistory(id) : [];
        if (version !== epoch.current) return;
        select(id, items);
      } catch { if (version === epoch.current) setHistoryError('Não foi possível carregar suas conversas. Tente novamente.'); }
      finally { if (version === epoch.current) { historyBusy.current = false; setHistoryLoading(false); } }
    })();
    return () => { epoch.current = version + 1; };
  }, [userId, authLoading, select]);

  const saveAdminToken = useCallback(async (token: string | null) => {
    if (!userId) throw new Error('Entre na sua conta antes de salvar o token administrativo.');
    const value = token?.trim() || null;
    setToken(value); setAdminToken(value); await writeValue('admin-token:' + userId, value);
  }, [userId]);

  const refreshConversations = useCallback(async () => {
    if (!userId) return;
    const version = epoch.current;
    const catalog = await readCatalog();
    if (version === epoch.current) { setConversations(catalog); setHistoryError(null); }
  }, [userId]);

  const openConversation = useCallback(async (id: string) => {
    if (!userId || sendingRef.current || historyBusy.current) return false;
    const version = epoch.current;
    historyBusy.current = true; setHistoryLoading(true); setHistoryError(null);
    try {
      const items = await readHistory(id);
      if (version !== epoch.current) return false;
      select(id, items);
      return true;
    } catch { if (version === epoch.current) setHistoryError('Não foi possível abrir a conversa. O chat atual foi mantido.'); return false; }
    finally { if (version === epoch.current) { historyBusy.current = false; setHistoryLoading(false); } }
  }, [select, userId]);

  const newConversation = useCallback(() => {
    if (!userId || sendingRef.current || historyBusy.current) return;
    select(newId(), []); setHistoryError(null);
  }, [select, userId]);

  const runQuestion = useCallback(async (entryId: string, question: string, filters?: ChatFilters) => {
    if (!userId || sendingRef.current || historyBusy.current || !conversationRef.current) return;
    const version = epoch.current;
    const id = conversationRef.current;
    sendingRef.current = true; setSending(true);
    try {
      const response = await api.chat({ question, conversation_id: id, filters });
      if (version !== epoch.current) return;
      setEntries((list) => list.map((e) => e.id === entryId ? { id: entryId, kind: 'answer', question, response } : e));
      try { await refreshConversations(); } catch { /* a resposta já foi salva; o catálogo poderá ser recarregado */ }
    } catch (err) {
      if (version === epoch.current) setEntries((list) => list.map((e) => e.id === entryId ?
        { id: entryId, kind: 'error', question, message: errorMessage(err), retryable: err instanceof ApiError ? err.retryable : true } : e));
    } finally { if (version === epoch.current) { sendingRef.current = false; setSending(false); } }
  }, [refreshConversations, userId]);

  const ask = useCallback(async (question: string, filters?: ChatFilters) => {
    const text = question.trim();
    if (!text || !userId || historyError || historyBusy.current || sendingRef.current) return;
    const id = `local_${Date.now().toString(36)}`;
    setEntries((list) => [...list, { id, kind: 'pending', question: text }]);
    await runQuestion(id, text, filters);
  }, [historyError, runQuestion, userId]);

  const retry = useCallback(async (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || entry.kind !== 'error' || historyBusy.current || sendingRef.current || historyError) return;
    setEntries((list) => list.map((e) => e.id === entryId ? { id: entryId, kind: 'pending', question: entry.question } : e));
    await runQuestion(entryId, entry.question);
  }, [entries, historyError, runQuestion]);

  const deleteConversation = useCallback(async (id: string) => {
    if (!userId || historyBusy.current || sendingRef.current) throw new Error('Aguarde a operação atual terminar.');
    const version = epoch.current;
    historyBusy.current = true; setHistoryLoading(true);
    try {
      await api.clearChat(id);
      if (version !== epoch.current) return;
      setConversations((list) => list.filter((c) => c.id !== id));
      if (conversationRef.current === id) select(newId(), []);
      setHistoryError(null);
    } finally { if (version === epoch.current) { historyBusy.current = false; setHistoryLoading(false); } }
  }, [select, userId]);

  const clearConversation = useCallback(async () => {
    if (!conversationRef.current) return;
    const version = epoch.current;
    try { await deleteConversation(conversationRef.current); }
    catch { if (version === epoch.current) setHistoryError('Não foi possível excluir a conversa. Ela continua salva.'); }
  }, [deleteConversation]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    if (!userId || historyBusy.current || sendingRef.current) throw new Error('Aguarde a operação atual terminar.');
    const version = epoch.current;
    await api.renameConversation(id, title.trim());
    if (version === epoch.current) setConversations((list) => list.map((c) => c.id === id ? { ...c, title: title.trim() } : c));
  }, [userId]);

  const importLegacy = useCallback(async () => {
    if (!userId || !adminToken) throw new Error('Entre na sua conta e informe o token administrativo.');
    const result = await api.importLegacy(legacyIds);
    await refreshConversations();
    await writeValue(CONVERSATIONS_KEY, null); await writeValue('conversation-id', null);
    setLegacyIds([]);
    return result.imported;
  }, [adminToken, legacyIds, refreshConversations, userId]);

  const value = useMemo(() => ({
    connection, health, lastHealthCheck, refreshHealth, adminToken, saveAdminToken, conversationId, conversations,
    entries, sending, historyLoading, historyError, openConversation, newConversation, ask, retry, clearConversation,
    renameConversation, deleteConversation, refreshConversations, importLegacy, legacyCount: legacyIds.length,
  }), [connection, health, lastHealthCheck, refreshHealth, adminToken, saveAdminToken, conversationId, conversations,
    entries, sending, historyLoading, historyError, openConversation, newConversation, ask, retry, clearConversation,
    renameConversation, deleteConversation, refreshConversations, importLegacy, legacyIds.length]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const state = useContext(AppStateContext);
  if (!state) throw new Error('useAppState deve ser usado dentro de AppStateProvider');
  return state;
}
