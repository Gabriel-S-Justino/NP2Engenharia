# Deploy do frontend web na Vercel

O frontend é exportado como site estático (SPA) pelo Expo e servido pela Vercel. O backend fica em outro serviço
(ver [DEPLOY_BACKEND.md](DEPLOY_BACKEND.md)) — **publique o backend primeiro** para ter a URL da API.

## Configuração do projeto (painel da Vercel)
1. **Add New → Project →** importe o repositório do GitHub.
2. **Root Directory:** `apps/mobile`.
3. **Framework Preset:** *Other* (o `vercel.json` define tudo).
4. Comandos (já em `apps/mobile/vercel.json`, validados localmente com Expo SDK 58):
   - Install: `npm ci`
   - Build: `npx expo export --platform web`
   - Output Directory: `dist`
   - Rewrites: todas as rotas → `/index.html` (rotas do Expo Router como `/chat` e `/documentos/[id]` funcionam
     ao recarregar a página).
5. **Environment Variables** (Settings → Environment Variables):

| Variável | Preview | Production | Observação |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | URL do backend de *preview/staging* | URL HTTPS do backend de produção | **Pública**: vai para o bundle. Nunca coloque chaves aqui. |

6. **Node.js:** 20 ou 22 (testado com 22).
7. No backend, inclua o domínio da Vercel em `CORS_ORIGINS` (ex.: `https://acervo-ia.vercel.app`). Para previews
   (domínios variáveis), aponte os previews para um backend de staging com os domínios de preview necessários.

## Fluxo de publicação
- **Preview:** cada push em branch de trabalho gera um deploy de preview pela integração Git da Vercel.
- **Produção:** deploy da branch principal. Recomenda-se desativar o deploy automático de produção (Settings → Git)
  ou proteger a branch `main` com revisão, para que **nada vá para produção sem autorização**.
- CI (`.github/workflows/ci.yml`) roda typecheck, lint, testes e build antes do merge; não publica nada.

## Deploy manual pela CLI (alternativa)
Execute dentro de `apps/mobile`, com login feito por `npx vercel login` (o token fica no seu computador, nunca no
repositório nem no chat):

```bash
npx vercel link
```

```bash
npx vercel env add EXPO_PUBLIC_API_URL preview
```

```bash
npx vercel deploy
```

```bash
npx vercel deploy --prod
```

O último comando publica em produção: use somente com autorização do responsável e depois de validar o preview
([TESTES_PRODUCAO.md](TESTES_PRODUCAO.md)).

## Validar um preview
```bash
WEB_URL=https://<preview>.vercel.app node tests/e2e/web_smoke.mjs
```
Com `ADMIN_TOKEN=<token>` no ambiente do comando se o backend exigir token (o script o injeta apenas no navegador
de teste). Confira também: recarregar `/chat` direto (rewrite), ausência de erros de CORS no console e que a tela
Configurações mostra a URL correta da API.

## Problemas comuns
| Sintoma | Solução |
|---|---|
| 404 ao recarregar `/chat` | Rewrites ausentes: confira `vercel.json` e o Root Directory |
| "Backend indisponível" | `EXPO_PUBLIC_API_URL` errada ou ausente **no momento do build** (variável pública é embutida no build; redeploy após mudar) |
| Erro de CORS | Domínio da Vercel ausente em `CORS_ORIGINS` do backend |
| Conteúdo misto (HTTP/HTTPS) | A URL da API precisa ser HTTPS |
