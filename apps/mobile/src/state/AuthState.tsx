import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { setAccessTokenGetter, setAuthFailureHandler } from '@/services/api';
import { getAuthClient } from '@/services/auth';

export type AccountUser = { id: string; email: string; name: string };
type AuthState = {
  user: AccountUser | null; loading: boolean; error: string | null;
  refreshSession: () => Promise<boolean>; signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setError(null);
    try {
      const client = await getAuthClient();
      const result = await client.getSession();
      if (result.error) throw new Error('session');
      const account = result.data?.user;
      setAccessTokenGetter(account ? async () => {
        const result = await client.getSession();
        // O SDK injeta o JWT curto em session.token usando o cabeçalho set-auth-jwt.
        return result.data?.session?.token ?? null;
      } : null);
      setUser(account ? { id: account.id, email: account.email, name: account.name } : null);
      return Boolean(account);
    } catch {
      setUser(null);
      setAccessTokenGetter(null);
      setError('Não foi possível verificar sua conta. Tente novamente.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setAuthFailureHandler(() => { if (alive) { setUser(null); setAccessTokenGetter(null); setError('Sua sessão expirou. Entre novamente.'); } });
    void Promise.resolve().then(() => refreshSession());
    return () => { alive = false; setAuthFailureHandler(null); setAccessTokenGetter(null); };
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    const client = await getAuthClient();
    const result = await client.signOut();
    if (result.error) throw new Error('Não foi possível sair. Verifique a conexão e tente novamente.');
    setAccessTokenGetter(null);
    setUser(null);
    setError(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, error, refreshSession, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return value;
}
