import { ApiError, api, request, setAdminToken, setBaseUrl } from '@/services/api';

const originalFetch = global.fetch;

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Partial<Response>>) {
  global.fetch = jest.fn(impl as never) as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown): Partial<Response> {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

beforeEach(() => {
  setBaseUrl('http://api.teste');
  setAdminToken(null);
});
afterAll(() => {
  global.fetch = originalFetch;
});

it('envia JSON e retorna dados tipados', async () => {
  mockFetch(async () => jsonResponse(200, { status: 'ok' }));
  const health = await api.health();
  expect(health.status).toBe('ok');
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('http://api.teste/api/health');
});

it('converte erro HTTP padronizado em ApiError com mensagem pública', async () => {
  mockFetch(async () => jsonResponse(409, { error: { code: 'duplicado', message: 'Este conteúdo já está no acervo.' } }));
  await expect(request('/api/x')).rejects.toMatchObject({ kind: 'http', status: 409, code: 'duplicado', message: 'Este conteúdo já está no acervo.' });
});

it('usa mensagem padrão quando o corpo não é JSON', async () => {
  mockFetch(async () => ({ ok: false, status: 503, text: async () => '<html>' }));
  await expect(request('/api/x')).rejects.toMatchObject({ status: 503, message: 'O serviço está temporariamente indisponível.' });
});

it('trata falha de rede sem expor detalhes técnicos', async () => {
  mockFetch(async () => {
    throw new TypeError('Failed to fetch');
  });
  const error = (await request('/api/x').catch((e: unknown) => e)) as ApiError;
  expect(error).toBeInstanceOf(ApiError);
  expect(error.kind).toBe('network');
  expect(error.retryable).toBe(true);
  expect(error.message).toMatch(/Não foi possível conectar/);
});

it('aplica timeout', async () => {
  mockFetch((_url, init) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))));
  const error = (await request('/api/x', { timeoutMs: 20 }).catch((e: unknown) => e)) as ApiError;
  expect(error.kind).toBe('timeout');
});

it('envia o token administrativo somente quando configurado', async () => {
  mockFetch(async () => jsonResponse(200, {}));
  await api.scan();
  expect((global.fetch as jest.Mock).mock.calls[0][1].headers['X-Admin-Token']).toBeUndefined();
  setAdminToken('segredo-local');
  await api.scan();
  expect((global.fetch as jest.Mock).mock.calls[1][1].headers['X-Admin-Token']).toBe('segredo-local');
});

it('codifica identificadores na URL (evita path traversal no cliente)', async () => {
  mockFetch(async () => jsonResponse(200, {}));
  await api.document('../etc/passwd');
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('http://api.teste/api/documents/..%2Fetc%2Fpasswd');
});
