import { Platform } from 'react-native';

/**
 * Endereço do backend.
 *
 * EXPO_PUBLIC_API_URL (variável PÚBLICA: entra no bundle; nunca coloque segredos) tem prioridade. Sem ela:
 * - Web publicada (ex.: Vercel): MESMA ORIGEM — o app chama `/api/...` no próprio domínio.
 * - Web em desenvolvimento (expo start em localhost:8081 ou :19006): http://127.0.0.1:8000
 * - Emulador Android: http://10.0.2.2:8000 (o "localhost" do emulador é o próprio emulador)
 * - iOS (simulador): http://127.0.0.1:8000
 * - Celular físico: defina EXPO_PUBLIC_API_URL com o IP do computador ou a URL da Vercel.
 */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

type Location = { hostname: string; port: string; origin: string } | null;

export function resolveApiBaseUrl(envUrl: string | undefined, platform: string, location: Location): string {
  if (envUrl && envUrl.trim()) return normalizeBaseUrl(envUrl);
  if (platform === 'web' && location) {
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    // Servidor de desenvolvimento do Expo (8081 / 19006): o backend roda à parte na porta 8000.
    if (local && (location.port === '8081' || location.port === '19006')) return 'http://127.0.0.1:8000';
    return ''; // mesma origem (Vercel ou qualquer servidor que entregue web + /api juntos)
  }
  return platform === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';
}

const webLocation: Location =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.location
    ? { hostname: window.location.hostname, port: window.location.port, origin: window.location.origin }
    : null;

export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL, Platform.OS, webLocation);

/** Descrição legível do endereço (tela Configurações). */
export function describeBaseUrl(url: string): string {
  return url === '' ? `mesma origem (${webLocation?.origin ?? 'domínio atual'})` : url;
}

/** Tempo máximo de espera por requisição (ms). */
export const REQUEST_TIMEOUT_MS = 20_000;
/** Perguntas: com LLM e, na Vercel, com o carregamento do modelo no primeiro acesso ("cold start"). */
export const CHAT_TIMEOUT_MS = 120_000;
/** Upload, indexação e avaliação: na Vercel são síncronos e podem durar até o limite da função (300 s). */
export const UPLOAD_TIMEOUT_MS = 310_000;
export const LONG_OPERATION_TIMEOUT_MS = 310_000;
