import { normalizeBaseUrl, resolveApiBaseUrl } from '@/services/config';

const vercel = { hostname: 'acervo-ia.vercel.app', port: '', origin: 'https://acervo-ia.vercel.app' };
const devServer = { hostname: 'localhost', port: '8081', origin: 'http://localhost:8081' };

it('usa EXPO_PUBLIC_API_URL quando definida', () => {
  expect(resolveApiBaseUrl('https://api.exemplo.app/', 'web', vercel)).toBe('https://api.exemplo.app');
  expect(resolveApiBaseUrl(' http://192.168.0.10:8000 ', 'android', null)).toBe('http://192.168.0.10:8000');
});

it('web publicada (Vercel) usa a mesma origem', () => {
  expect(resolveApiBaseUrl(undefined, 'web', vercel)).toBe('');
  expect(resolveApiBaseUrl('', 'web', vercel)).toBe('');
});

it('web em desenvolvimento aponta para o backend local', () => {
  expect(resolveApiBaseUrl(undefined, 'web', devServer)).toBe('http://127.0.0.1:8000');
  // Simulação local da Vercel (web + /api no mesmo servidor) usa a mesma origem.
  expect(resolveApiBaseUrl(undefined, 'web', { hostname: '127.0.0.1', port: '3000', origin: 'http://127.0.0.1:3000' })).toBe('');
});

it('nativo usa o endereço do emulador/simulador', () => {
  expect(resolveApiBaseUrl(undefined, 'android', null)).toBe('http://10.0.2.2:8000');
  expect(resolveApiBaseUrl(undefined, 'ios', null)).toBe('http://127.0.0.1:8000');
  expect(normalizeBaseUrl('http://x///')).toBe('http://x');
});
