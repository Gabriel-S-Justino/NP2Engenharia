import { Platform } from 'react-native';

/**
 * Endereço do backend.
 *
 * Definido por EXPO_PUBLIC_API_URL (variável PÚBLICA: entra no bundle; nunca coloque segredos).
 * - Navegador no mesmo computador: http://127.0.0.1:8000
 * - Emulador Android: http://10.0.2.2:8000 (o "localhost" do emulador é o próprio emulador)
 * - Celular físico: http://<IP-do-computador-na-rede-local>:8000 (backend iniciado com API_HOST=0.0.0.0)
 * - Produção: URL HTTPS do backend implantado (ver docs/DEPLOY_VERCEL.md)
 */
const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export const API_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL);

/** Tempo máximo de espera por requisição (ms). Perguntas com LLM podem demorar mais. */
export const REQUEST_TIMEOUT_MS = 20_000;
export const CHAT_TIMEOUT_MS = 90_000;
export const UPLOAD_TIMEOUT_MS = 120_000;
