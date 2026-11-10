import { createAuthClient } from '@neon/auth';
import { BetterAuthVanillaAdapter } from '@neon/auth/vanilla/adapters';
import { API_BASE_URL } from './config';

type ManagedResult<T> = { data: T | null; error: { code?: string; message?: string } | null };
type ManagedMethods = {
  emailOtp: {
    sendVerificationOtp: (body: { email: string; type: 'forget-password' }) => Promise<ManagedResult<{ success: boolean }>>;
    resetPassword: (body: { email: string; otp: string; password: string }) => Promise<ManagedResult<{ success: boolean }>>;
  };
};
// @neon/auth 0.8.2 omite extensões gerenciadas no tipo do adaptador vanilla.
// Os métodos abaixo são do SDK oficial, confirmados no servidor e na documentação.
function makeClient(url: string) {
  const client = createAuthClient(url, { adapter: BetterAuthVanillaAdapter() });
  return client as typeof client & ManagedMethods;
}
let clientPromise: Promise<ReturnType<typeof makeClient>> | null = null;

export function getAuthClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/api/auth/config`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('O serviço de acesso está indisponível.');
      const config = await response.json() as { base_url?: string; configured?: boolean };
      if (!config.configured || !config.base_url?.startsWith('https://')) throw new Error('O acesso às contas ainda não foi configurado.');
      return makeClient(config.base_url);
    })().catch((error: unknown) => { clientPromise = null; throw error; });
  }
  return clientPromise;
}

export function authMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code.includes('INVALID_EMAIL_OR_PASSWORD')) return 'E-mail ou senha incorretos.';
  if (code.includes('TOO_MANY')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  if (code.includes('OTP')) return 'O código não é válido ou expirou. Solicite outro.';
  if (code.includes('PASSWORD')) return 'Confira a senha. Use pelo menos 12 caracteres ao criar uma nova senha.';
  if (code.includes('EMAIL_NOT_VERIFIED')) return 'Confirme seu e-mail antes de entrar.';
  if (code.includes('EXISTS')) return 'Não foi possível criar a conta. Tente entrar ou recuperar o acesso.';
  return 'Não foi possível concluir o acesso. Confira seus dados e tente novamente.';
}
