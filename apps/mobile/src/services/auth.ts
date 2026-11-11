import { createAuthClient } from '@neon/auth';
import { BetterAuthVanillaAdapter } from '@neon/auth/vanilla/adapters';
import { API_BASE_URL } from './config';

export const MIN_PASSWORD_LENGTH = 8;

type ManagedResult<T> = { data: T | null; error: { code?: string; message?: string } | null };
type ManagedMethods = {
  emailOtp: {
    requestPasswordReset: (body: { email: string }) => Promise<ManagedResult<{ success: boolean }>>;
    resetPassword: (body: { email: string; otp: string; password: string }) => Promise<ManagedResult<{ success: boolean }>>;
  };
};
// @neon/auth 0.8.2 omite extensões gerenciadas no tipo do adaptador vanilla.
// Os métodos abaixo são do SDK oficial, confirmados no servidor e na documentação.
function makeClient(url: string) {
  const client = createAuthClient(url, { adapter: BetterAuthVanillaAdapter({ fetchOptions: { timeout: 15_000 } }) });
  return client as typeof client & ManagedMethods;
}
let clientPromise: Promise<ReturnType<typeof makeClient>> | null = null;

export function getAuthClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        return await loadAuthClient(controller.signal);
      } finally {
        clearTimeout(timer);
      }
    })().catch((error: unknown) => { clientPromise = null; throw error; });
  }
  return clientPromise;
}

async function loadAuthClient(signal: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/auth/config`, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw Object.assign(new Error('Falha ao consultar o acesso'), { status: response.status });
  const config = await response.json() as { base_url?: string; configured?: boolean };
  if (!config.configured || !config.base_url?.startsWith('https://')) {
    throw Object.assign(new Error('Acesso indisponível'), { code: 'AUTH_NOT_CONFIGURED' });
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    const apiOrigin = new URL(API_BASE_URL || window.location.origin, window.location.href).origin;
    if (apiOrigin === window.location.origin && window.location.protocol === 'https:') {
      return makeClient(`${apiOrigin}/api/auth`);
    }
  }
  return makeClient(config.base_url);
}

type AuthProblem = { code?: string; status?: number; name?: string; error?: { code?: string } };

export function authMessage(error: unknown): string {
  const problem = error && typeof error === 'object' ? error as AuthProblem : {};
  // O SDK pode lançar AuthApiError com o código original dentro de error.
  const code = String(problem.error?.code ?? problem.code ?? '').toUpperCase();
  if (code === 'INVALID_ORIGIN') return 'Abra o acesso pelo endereço oficial lumme.vercel.app.';
  if (code === 'AUTH_NOT_CONFIGURED') return 'O acesso às contas ainda não foi configurado.';
  if (problem.status === 429 || code.includes('TOO_MANY') || code.includes('RATE_LIMIT')) {
    return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  }
  if (code === 'AUTH_TIMEOUT' || problem.name === 'AbortError' || problem.name === 'TimeoutError') {
    return 'O serviço de acesso demorou a responder. Tente novamente.';
  }
  if (code.includes('INVALID_EMAIL_OR_PASSWORD') || code === 'INVALID_CREDENTIALS') return 'E-mail ou senha incorretos.';
  if (code.includes('EMAIL_NOT_VERIFIED')) return 'Confirme seu e-mail antes de entrar.';
  if (code.includes('OTP')) return 'O código não é válido ou expirou. Solicite outro.';
  if (code.includes('EXISTS') || code.includes('ALREADY_REGISTERED')) {
    return 'Tente entrar com esse e-mail ou use Esqueci minha senha.';
  }
  if (code.includes('PASSWORD')) return `Confira a senha. Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres ao criar uma nova senha.`;
  if (code === 'AUTH_UNAVAILABLE' || (problem.status ?? 0) >= 500) {
    return 'O serviço de acesso está temporariamente indisponível. Tente novamente mais tarde.';
  }
  if (problem.name === 'TypeError') return 'Não foi possível conectar ao serviço de acesso. Confira a conexão e tente novamente.';
  return 'Não foi possível concluir o acesso. Confira seus dados e tente novamente.';
}
