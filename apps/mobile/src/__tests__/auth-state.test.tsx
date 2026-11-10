import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { setAccessTokenGetter, setAuthFailureHandler } from '@/services/api';
import { getAuthClient } from '@/services/auth';
import { AuthProvider, useAuth } from '@/state/AuthState';

jest.mock('@/services/auth', () => ({ getAuthClient: jest.fn() }));
jest.mock('@/services/api', () => ({ setAccessTokenGetter: jest.fn(), setAuthFailureHandler: jest.fn() }));
const client={getSession:jest.fn(),signOut:jest.fn()};
function Wrapper({children}:{children:ReactNode}){return <AuthProvider>{children}</AuthProvider>;}
beforeEach(()=>{
  jest.clearAllMocks();
  jest.mocked(getAuthClient).mockResolvedValue(client as never);
  client.getSession.mockResolvedValue({data:{user:{id:'a',name:'Ana',email:'a@example.com'},session:{token:'sdk-injected-jwt'}},error:null});
  client.signOut.mockResolvedValue({data:{success:true},error:null});
});
it('usa o JWT injetado pelo SDK em session.token e restaura a conta',async()=>{
  const h=await renderHook(()=>useAuth(),{wrapper:Wrapper});
  await waitFor(()=>expect(h.result.current.loading).toBe(false));
  expect(h.result.current.user?.id).toBe('a');
  const getter=jest.mocked(setAccessTokenGetter).mock.calls.find(([fn])=>typeof fn==='function')?.[0];
  expect(await getter?.()).toBe('sdk-injected-jwt');
});
it('limpa a identidade ao receber 401 da API',async()=>{
  const h=await renderHook(()=>useAuth(),{wrapper:Wrapper});
  await waitFor(()=>expect(h.result.current.loading).toBe(false));
  const failure=jest.mocked(setAuthFailureHandler).mock.calls[0][0];
  await act(async()=>failure?.());
  expect(h.result.current.user).toBeNull();
  expect(h.result.current.error).toContain('expirou');
});
it('mantém a conta se sair falhar e limpa após saída confirmada',async()=>{
  const h=await renderHook(()=>useAuth(),{wrapper:Wrapper});
  await waitFor(()=>expect(h.result.current.loading).toBe(false));
  client.signOut.mockResolvedValueOnce({error:{message:'offline'}});
  await act(async()=>{await expect(h.result.current.signOut()).rejects.toThrow();});
  expect(h.result.current.user?.id).toBe('a');
  await act(async()=>h.result.current.signOut());
  expect(h.result.current.user).toBeNull();
});
