# Deploy alternativo do backend em contêiner (fora da Vercel)

> **O caminho principal é a aplicação completa na Vercel** ([DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)): web + função
> Python + Neon Postgres. Este documento descreve a **alternativa** de hospedar a API como contêiner — útil se um
> limite da plataforma mudar, para indexações muito longas no próprio servidor ou para uso com OCR.
>
> Nesse caso: defina `EXPO_PUBLIC_API_URL=https://<backend>` nas variáveis do projeto da Vercel (a web passa a
> chamar o contêiner em vez de `/api` local) e inclua o domínio da Vercel em `CORS_ORIGINS` do contêiner.

Requisito: serviço que rode **contêiner Docker** com **disco persistente** montado em `/var/data` — ou, sem disco,
com `DATABASE_URL` apontando para um Postgres com pgvector (o mesmo código usa Postgres quando a variável existe).
Abaixo, o caminho com Render (blueprint `render.yaml`); a mesma imagem funciona em Railway (volume) e Fly.io (volume).

## Imagem
`Dockerfile` na raiz: Python 3.13-slim, dependências de `backend/requirements.txt`, usuário sem root, health check
em `/api/health`, porta `$PORT` (padrão 8000), `DATA_DIR=/var/data`, cache do modelo em `/var/data/models`.
Copia `Documentos/` (somente os documentos versionados), matrizes e fixtures de avaliação.

Teste local (exige Docker):

```bash
docker build -t acervo-ia-backend .
```

```bash
docker run --rm -p 127.0.0.1:8000:8000 -v "$PWD/data:/var/data" -e APP_ENV=development acervo-ia-backend
```

> Neste ambiente de desenvolvimento a imagem **não pôde ser construída** (Docker Hub respondeu 429 — limite de
> requisições). O mesmo comando de inicialização foi validado fora do contêiner (ver TESTES_PRODUCAO.md). Construa
> a imagem localmente ou no CI antes do primeiro deploy.

## Render (blueprint)
1. Render → **New → Blueprint** → selecione o repositório (lê `render.yaml`).
2. O serviço `acervo-ia-backend` usa plano com disco (`acervo-data`, 1 GB, em `/var/data`). Discos persistentes
   exigem plano pago no Render — **confira preços e limites atuais** no site do Render antes de criar.
3. Defina no painel (variáveis marcadas `sync: false`):
   - `CORS_ORIGINS` = `https://<seu-projeto>.vercel.app`
   - `ADMIN_TOKEN` = valor longo e aleatório (ex.: gerado com `python -c "import secrets;print(secrets.token_urlsafe(32))"`)
   - `LLM_API_KEY` = chave do provedor (opcional; mantenha `LLM_PROVIDER=demo` até configurá-la)
4. `autoDeploy: false`: publique manualmente após validar (botão *Manual Deploy*).
5. Após o deploy: `GET https://<backend>/api/health` deve retornar `status: ok` (na 1ª inicialização, o download
   do modelo de embeddings pode levar alguns minutos).
6. Indexe: na interface (Configurações → token administrativo → Documentos → Indexar pasta), ou envie arquivos pela
   interface. Com `AUTO_INGEST_ON_STARTUP=true`, documentos versionados em `Documentos/` são indexados no início.

## Railway / Fly.io (alternativas)
- Railway: novo serviço a partir do repositório (Dockerfile detectado) + **Volume** montado em `/var/data`;
  mesmas variáveis.
- Fly.io: `fly launch` (usa o Dockerfile) + `fly volumes create acervo_data` montado em `/var/data`; 1 máquina.

## Documentos em produção
- Documentos **públicos** (leis, resoluções) podem ser versionados em `Documentos/` (ajuste o `.gitignore` para
  incluí-los) e entram na imagem.
- Documentos que não devem ir para o GitHub: envie pela interface (ficam em `/var/data/uploads`).

## Checklist pós-deploy
- [ ] `/api/health` = ok, `embeddings.semantic = true`, `vector_store.compatible = true`
- [ ] Operação administrativa sem token retorna 403
- [ ] CORS aceita o domínio da Vercel e rejeita outros
- [ ] Indexação concluída sem falhas inesperadas; `/api/ingestion/status` → `consistent: true`
- [ ] Limiar recalibrado com o acervo real (`scripts/calibrate_threshold.py --real` em ambiente com os mesmos dados)
- [ ] Matriz do acervo real executada e registrada
- [ ] Reiniciar o serviço e confirmar que documentos, índice e histórico persistem
