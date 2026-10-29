// Teste ponta a ponta da versão web contra um backend real (Playwright + Chromium).
// Pré-requisitos: backend em execução e build web (apontando para ele) servido em WEB_URL (ver docs/TESTES_PRODUCAO.md).
// Uso: node tests/e2e/web_smoke.mjs   (variáveis opcionais: WEB_URL, ADMIN_TOKEN, SHOTS_DIR)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:8081';
const SHOTS = process.env.SHOTS_DIR ?? 'docs/capturas';
const TOKEN = process.env.ADMIN_TOKEN ?? '';
mkdirSync(SHOTS, { recursive: true });

const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: String(err).slice(0, 300) });
    console.log(`  ✗ ${name}\n      ${String(err).slice(0, 300)}`);
  }
}

const browser = await chromium.launch();
const consoleErrors = [];

async function newPage(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  if (TOKEN) {
    await page.addInitScript((t) => localStorage.setItem('acervo-ia:admin-token', t), TOKEN);
  }
  return page;
}

console.log(`E2E em ${WEB}`);
const desktop = await newPage(1366, 900);

await step('Dashboard carrega com indicadores reais e conexão', async () => {
  await desktop.goto(WEB, { waitUntil: 'networkidle' });
  await desktop.getByText('Visão geral').first().waitFor();
  await desktop.getByText('Backend conectado').first().waitFor({ timeout: 15000 });
  await desktop.getByText('Documentos cadastrados').waitFor();
  await desktop.screenshot({ path: `${SHOTS}/01_dashboard_desktop.png`, fullPage: true });
});

await step('Biblioteca: indexar pasta e ver documentos processados', async () => {
  await desktop.getByRole('link', { name: 'Documentos' }).click();
  await desktop.getByRole('button', { name: 'Indexar pasta' }).click();
  await desktop.getByText(/Última indexação/).waitFor({ timeout: 30000 });
  await desktop.getByText('Processado').first().waitFor({ timeout: 30000 });
  await desktop.screenshot({ path: `${SHOTS}/02_documentos_desktop.png`, fullPage: true });
});

await step('Detalhes do documento mostram metadados e trechos', async () => {
  await desktop.getByLabel(/Abrir detalhes de Regulamento/).click();
  await desktop.getByRole('heading', { name: 'Metadados' }).waitFor();
  await desktop.getByText(/Trechos indexados/).waitFor();
  await desktop.screenshot({ path: `${SHOTS}/03_documento_detalhe.png`, fullPage: true });
});

await step('Chat: pergunta respondida com evidências e painel lateral', async () => {
  await desktop.getByRole('link', { name: 'Assistente' }).click();
  const input = desktop.getByTestId('campo-pergunta');
  await input.fill('Qual é a velocidade máxima permitida nas vias escolares de Vila Exemplo?');
  await input.press('Enter');
  await desktop.getByText('RESPOSTA').first().waitFor({ timeout: 30000 });
  await desktop.getByText(/25 km\/h/).first().waitFor();
  await desktop.getByText('Evidências da última resposta').waitFor();
  await desktop.screenshot({ path: `${SHOTS}/04_chat_resposta_desktop.png`, fullPage: true });
});

await step('Chat: pergunta sem evidência resulta em recusa clara', async () => {
  const input = desktop.getByTestId('campo-pergunta');
  await input.fill('Qual é o valor da multa por usar celular ao dirigir em Vila Exemplo?');
  await desktop.getByTestId('botao-enviar').click();
  await desktop.getByText(/Não encontrei evidências suficientes/).last().waitFor({ timeout: 30000 });
  await desktop.screenshot({ path: `${SHOTS}/05_chat_sem_evidencia.png`, fullPage: true });
});

await step('Fonte: detalhes do trecho citado', async () => {
  await desktop.getByLabel(/Abrir detalhes de Fonte F1/).first().click();
  await desktop.getByText('Trecho de origem').waitFor({ timeout: 15000 });
  await desktop.screenshot({ path: `${SHOTS}/06_fonte_detalhe.png`, fullPage: true });
});

await step('Laboratório: executar a matriz e ver taxa por categoria', async () => {
  await desktop.getByRole('link', { name: 'Avaliação' }).click();
  await desktop.getByTestId('botao-executar-testes').click();
  await desktop.getByText('Resultado por categoria').waitFor({ timeout: 60000 });
  await desktop.getByText('Taxa de aprovação').waitFor();
  await desktop.screenshot({ path: `${SHOTS}/07_avaliacao_desktop.png`, fullPage: true });
});

await step('Configurações exibem parâmetros sem segredos', async () => {
  await desktop.getByRole('link', { name: 'Configurações' }).click();
  await desktop.getByText('Recuperação e chunking').waitFor();
  const html = await desktop.content();
  if (/sk-ant-[A-Za-z0-9]/.test(html)) throw new Error('possível chave exposta');
  await desktop.screenshot({ path: `${SHOTS}/08_configuracoes.png`, fullPage: true });
});

await step('Navegação por teclado alcança links do menu com foco visível', async () => {
  await desktop.goto(WEB, { waitUntil: 'networkidle' });
  let found = false;
  for (let i = 0; i < 25 && !found; i++) {
    await desktop.keyboard.press('Tab');
    const label = await desktop.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
    if (label === 'Assistente') found = true;
  }
  if (!found) throw new Error('link "Assistente" não alcançado por Tab');
  await desktop.keyboard.press('Enter');
  await desktop.getByText('Assistente documental').waitFor();
});

const mobile = await newPage(390, 844);
await step('Celular: barra inferior, chat e histórico preservado', async () => {
  await mobile.goto(`${WEB}/chat`, { waitUntil: 'networkidle' });
  await mobile.getByRole('link', { name: 'Visão geral' }).waitFor();
  await mobile.getByText('Assistente documental').waitFor();
  await mobile.screenshot({ path: `${SHOTS}/09_chat_mobile.png`, fullPage: false });
  await mobile.getByRole('button', { name: 'Mais opções de navegação' }).click();
  await mobile.getByText('Diário da IA mentora').waitFor();
  await mobile.screenshot({ path: `${SHOTS}/10_menu_mais_mobile.png` });
});

await step('Tablet: menu lateral recolhido', async () => {
  const tablet = await newPage(820, 1180);
  await tablet.goto(WEB, { waitUntil: 'networkidle' });
  await tablet.getByRole('button', { name: 'Expandir menu' }).waitFor();
  await tablet.screenshot({ path: `${SHOTS}/11_dashboard_tablet.png` });
});

await browser.close();
const failed = results.filter((r) => !r.ok);
const relevantErrors = consoleErrors.filter((e) => !/favicon|DevTools/.test(e));
console.log(`\n${results.length - failed.length}/${results.length} etapas aprovadas.`);
if (relevantErrors.length) console.log(`Erros de console (${relevantErrors.length}):\n- ${[...new Set(relevantErrors)].slice(0, 10).join('\n- ')}`);
process.exit(failed.length ? 1 : 0);
