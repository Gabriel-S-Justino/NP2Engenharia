import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { api } from '@/services/api';
import { readValue, writeValue } from '@/services/storage';
import { useAuth } from '@/state/AuthState';
import { AppStateProvider, useAppState } from '@/state/AppState';
import { chatResponse } from '@/test-utils/fixtures';

jest.mock('@/state/AuthState', () => ({ useAuth: jest.fn() }));
jest.mock('@/services/storage', () => ({ readValue: jest.fn(), writeValue: jest.fn() }));
jest.mock('@/services/api', () => {
  const actual = jest.requireActual('@/services/api');
  return { ...actual, api: { health: jest.fn(), chat: jest.fn(), chatHistory: jest.fn(), clearChat: jest.fn(), conversations: jest.fn(), renameConversation: jest.fn(), importLegacy: jest.fn() } };
});
const mocked = api as jest.Mocked<typeof api>;
const saved = new Map<string,string>();
function Wrapper({children}:{children:ReactNode}) { return <AppStateProvider pollMs={0}>{children}</AppStateProvider>; }
const auth = (id:string|null) => jest.mocked(useAuth).mockReturnValue({user:id?{id,email:id+'@example.com',name:id}:null,loading:false} as ReturnType<typeof useAuth>);
beforeEach(() => {
  jest.resetAllMocks(); saved.clear(); auth('a');
  jest.mocked(readValue).mockImplementation(async k=>saved.get(k)??null);
  jest.mocked(writeValue).mockImplementation(async(k,v)=>{if(v===null)saved.delete(k);else saved.set(k,v);});
  mocked.health.mockResolvedValue({status:'ok',issues:[]} as never);
  mocked.conversations.mockResolvedValue({items:[{id:'a-chat',title:'Estudo',updated_at:'2026-11-10T12:00:00Z'}],has_more:false});
  mocked.chatHistory.mockImplementation(async id=>({conversation_id:id,items:[{...chatResponse(),conversation_id:id}]}));
});
it('restaura o catálogo do servidor e a seleção de cada conta',async()=>{
  saved.set('conversation-id:a','a-chat');
  const h=await renderHook(()=>useAppState(),{wrapper:Wrapper});
  await waitFor(()=>expect(h.result.current.historyLoading).toBe(false));
  expect(h.result.current.conversationId).toBe('a-chat');
  expect(h.result.current.entries).toHaveLength(1);
  auth('b'); mocked.conversations.mockResolvedValue({items:[],has_more:false});
  await h.rerender({});
  await waitFor(()=>expect(h.result.current.conversations).toHaveLength(0));
  expect(h.result.current.entries).toHaveLength(0);
  expect(h.result.current.conversationId).not.toBe('a-chat');
});
it('não reivindica histórico anônimo nem chama APIs privadas como visitante',async()=>{
  auth(null);saved.set('conversation-id','legacy');
  const h=await renderHook(()=>useAppState(),{wrapper:Wrapper});
  await waitFor(()=>expect(h.result.current.historyLoading).toBe(false));
  await act(async()=>h.result.current.ask('Pergunta'));
  expect(mocked.conversations).not.toHaveBeenCalled();
  expect(mocked.chatHistory).not.toHaveBeenCalled();
  expect(mocked.chat).not.toHaveBeenCalled();
  expect(h.result.current.legacyCount).toBe(1);
});
it('mantém catálogo e conversa se a exclusão falhar',async()=>{
  const h=await renderHook(()=>useAppState(),{wrapper:Wrapper});
  await waitFor(()=>expect(h.result.current.historyLoading).toBe(false));
  mocked.clearChat.mockRejectedValue(new Error('offline'));
  await act(async()=>h.result.current.clearConversation());
  expect(h.result.current.conversationId).toBe('a-chat');
  expect(h.result.current.conversations).toHaveLength(1);
  expect(h.result.current.historyError).toContain('continua salva');
});
it('renomeia após confirmação do servidor e preserva o chat ao iniciar outro',async()=>{
  const h=await renderHook(()=>useAppState(),{wrapper:Wrapper});
  await waitFor(()=>expect(h.result.current.historyLoading).toBe(false));
  await act(async()=>h.result.current.renameConversation('a-chat','Novo título'));
  expect(mocked.renameConversation).toHaveBeenCalledWith('a-chat','Novo título');
  expect(h.result.current.conversations[0].title).toBe('Novo título');
  await act(async()=>h.result.current.newConversation());
  expect(h.result.current.entries).toHaveLength(0);
  expect(h.result.current.conversations).toHaveLength(1);
});
it('ignora respostas atrasadas depois de trocar de conta',async()=>{
  let resolve!:(value:ReturnType<typeof chatResponse>)=>void;
  mocked.chat.mockReturnValue(new Promise(r=>{resolve=r;}));
  const h=await renderHook(()=>useAppState(),{wrapper:Wrapper});
  await waitFor(()=>expect(h.result.current.historyLoading).toBe(false));
  await act(async()=>{void h.result.current.ask('Como atravessar?'); await Promise.resolve();});
  await waitFor(()=>expect(h.result.current.sending).toBe(true));
  auth('b');mocked.conversations.mockResolvedValue({items:[],has_more:false});
  await h.rerender({});
  await waitFor(()=>expect(h.result.current.sending).toBe(false));
  await act(async()=>resolve(chatResponse()));
  expect(h.result.current.entries).toHaveLength(0);
});
it('carrega todas as páginas do histórico',async()=>{
  mocked.chatHistory.mockImplementation(async(id,offset=0)=>({conversation_id:id,items:[{...chatResponse(),interaction_id:String(offset)}],has_more:offset===0}));
  const h=await renderHook(()=>useAppState(),{wrapper:Wrapper});
  await waitFor(()=>expect(h.result.current.historyLoading).toBe(false));
  expect(h.result.current.entries).toHaveLength(2);
  expect(mocked.chatHistory).toHaveBeenCalledWith('a-chat',1);
});
