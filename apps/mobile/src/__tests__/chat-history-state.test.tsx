import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { api } from '@/services/api';
import { readValue, writeValue } from '@/services/storage';
import { AppStateProvider, useAppState } from '@/state/AppState';
import { chatResponse } from '@/test-utils/fixtures';
import { CONVERSATIONS_KEY } from '@/utils/conversations';

jest.mock('@/services/storage', () => ({ readValue: jest.fn(), writeValue: jest.fn() }));
jest.mock('@/services/api', () => {
  const actual = jest.requireActual('@/services/api');
  return { ...actual, api: { health: jest.fn(), chat: jest.fn(), chatHistory: jest.fn(), clearChat: jest.fn() } };
});
const mocked = api as jest.Mocked<typeof api>;
const saved = new Map<string, string>();
const answer = (id: string, question: string, n = 1) => ({
  ...chatResponse(), conversation_id: id, interaction_id: id + n, question,
  created_at: `2026-11-09T12:00:0${n}Z`,
});
function Wrapper({ children }: { children: ReactNode }) {
  return <AppStateProvider pollMs={0}>{children}</AppStateProvider>;
}

beforeEach(() => {
  jest.resetAllMocks();
  saved.clear();
  jest.mocked(readValue).mockImplementation(async (key) => saved.get(key) ?? null);
  jest.mocked(writeValue).mockImplementation(async (key, value) => { if (value === null) saved.delete(key); else saved.set(key, value); });
  mocked.health.mockResolvedValue({ status: 'ok', issues: [] } as never);
  mocked.chatHistory.mockImplementation(async (id) => ({ conversation_id: id, items: [] }));
});

it('migra a conversa existente, preserva fontes e restaura a seleção após remontar', async () => {
  saved.set('conversation-id', 'legacy');
  const response = answer('legacy', 'Pergunta anterior');
  mocked.chatHistory.mockResolvedValue({ conversation_id: 'legacy', items: [response] });
  const hook = await renderHook(() => useAppState(), { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.historyLoading).toBe(false));
  expect(hook.result.current.conversations[0].title).toBe('Pergunta anterior');
  expect(hook.result.current.entries[0]).toMatchObject({ response: { citations: response.citations } });
  await waitFor(() => expect(saved.get(CONVERSATIONS_KEY)).toContain('legacy'));
  await hook.unmount();
  const restored = await renderHook(() => useAppState(), { wrapper: Wrapper });
  await waitFor(() => expect(restored.result.current.historyLoading).toBe(false));
  expect(restored.result.current.conversationId).toBe('legacy');
  expect(restored.result.current.conversations).toHaveLength(1);
});

it('nova conversa preserva a anterior e permite retomá-la', async () => {
  saved.set('conversation-id', 'old');
  mocked.chatHistory.mockResolvedValue({ conversation_id: 'old', items: [answer('old', 'Anterior')] });
  const { result } = await renderHook(() => useAppState(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.historyLoading).toBe(false));
  await act(() => result.current.newConversation());
  const next = result.current.conversationId;
  expect(next).not.toBe('old');
  expect(result.current.entries).toHaveLength(0);
  expect(mocked.clearChat).not.toHaveBeenCalled();
  mocked.chat.mockResolvedValue(answer(next!, 'Nova pergunta'));
  await act(async () => { await result.current.ask('Nova pergunta'); });
  expect(result.current.conversations).toHaveLength(2);
  await act(async () => { await result.current.openConversation('old'); });
  expect(result.current.conversationId).toBe('old');
  expect(result.current.entries[0].question).toBe('Anterior');
});

it('não troca de chat durante envio nem dispara pergunta duplicada', async () => {
  const { result } = await renderHook(() => useAppState(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.historyLoading).toBe(false));
  const id = result.current.conversationId!;
  let finish!: (response: ReturnType<typeof chatResponse>) => void;
  mocked.chat.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(() => { pending = result.current.ask('Pergunta'); });
  await act(() => { result.current.newConversation(); });
  await act(async () => { await result.current.ask('Duplicada'); });
  expect(result.current.conversationId).toBe(id);
  expect(mocked.chat).toHaveBeenCalledTimes(1);
  await act(async () => { finish(answer(id, 'Pergunta')); await pending; });
  expect(result.current.entries[0].kind).toBe('answer');
});

it('falha ao abrir ou apagar mantém a conversa atual e o catálogo', async () => {
  saved.set('conversation-id', 'old');
  mocked.chatHistory.mockResolvedValue({ conversation_id: 'old', items: [answer('old', 'Minha pergunta')] });
  const { result } = await renderHook(() => useAppState(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.historyLoading).toBe(false));
  mocked.chatHistory.mockRejectedValue(new Error('offline'));
  await act(async () => { expect(await result.current.openConversation('old')).toBe(false); });
  expect(result.current.entries[0].question).toBe('Minha pergunta');
  mocked.clearChat.mockRejectedValue(new Error('offline'));
  await act(async () => { await result.current.clearConversation(); });
  expect(result.current.conversations).toHaveLength(1);
  expect(result.current.entries).toHaveLength(1);
  expect(result.current.historyError).toContain('continua salva');
  mocked.clearChat.mockResolvedValue({ removed: 1 });
  await act(async () => { await result.current.clearConversation(); });
  expect(result.current.entries).toHaveLength(0);
  expect(result.current.conversations).toHaveLength(0);
});

it('carrega todas as páginas sem perder as mensagens mais recentes', async () => {
  saved.set('conversation-id', 'paged');
  mocked.chatHistory.mockImplementation(async (id, offset = 0) => ({
    conversation_id: id, items: [answer(id, offset === 0 ? 'Primeira' : 'Última', offset + 1)], has_more: offset === 0,
  }));
  const { result } = await renderHook(() => useAppState(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.historyLoading).toBe(false));
  expect(result.current.entries.map((e) => e.question)).toEqual(['Primeira', 'Última']);
  expect(mocked.chatHistory).toHaveBeenNthCalledWith(2, 'paged', 1);
});

it('preserva o identificador legado se o servidor estiver indisponível', async () => {
  saved.set('conversation-id', 'offline');
  mocked.chatHistory.mockRejectedValue(new Error('offline'));
  const { result } = await renderHook(() => useAppState(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.historyLoading).toBe(false));
  expect(result.current.conversations[0].id).toBe('offline');
  expect(result.current.historyError).toBeTruthy();
  mocked.chatHistory.mockResolvedValue({ conversation_id: 'offline', items: [answer('offline', 'Recuperada')] });
  await act(async () => { await result.current.openConversation('offline'); });
  expect(result.current.entries[0].question).toBe('Recuperada');
  expect(result.current.historyError).toBeNull();
});
