# Configuração e acervo fornecidos manualmente

O código exige geração real com Gemini (Google). Não há download automático de documentos nem modo demonstrativo na aplicação. Os geradores simulados existem somente para testes automatizados em `APP_ENV=test`.

## Antes de iniciar

1. Execute `npm run setup` para instalar dependências. O setup preserva um `.env` existente.
2. Configure `LLM_PROVIDER=gemini`, `LLM_API_KEY` e `LLM_MODEL` com um modelo disponível na sua conta. Uma configuração antiga com `LLM_PROVIDER=demo` deve ser atualizada manualmente.
3. Adicione seus documentos em `Documentos/` e preencha `manifest.json`, ou envie os arquivos pela biblioteca.
4. Inicie com `npm run dev` e execute a indexação pela interface. Informe o `ADMIN_TOKEN` na tela Configurações quando exigido.

Sem documentos indexados, o chat informa que o acervo está vazio. Sem chave do provedor, a inicialização é bloqueada, sem fallback extrativo.

## Calibrar e avaliar

Preencha `tests/acceptance/matriz_acervo_real.json` a partir dos seus documentos e marque `ready: true`. Preencha `tests/acceptance/calibracao_real.json` com perguntas independentes verificadas nas fontes. Execute `npm run prepare` somente depois disso. O comando não baixa documentos e a avaliação com LLM real pode consumir créditos.

O limiar inicial do modelo semântico não foi calibrado para o seu acervo; a preparação aplica a sugestão apenas se a calibração atingir os critérios de aprovação. Consulte o relatório gerado e revise as respostas.

## Hospedagem

Configure `DATABASE_URL`, `ADMIN_TOKEN`, `CRON_SECRET`, `LLM_PROVIDER=gemini`, `LLM_API_KEY` e `LLM_MODEL` no servidor. Não copie o `.env` inteiro para a Vercel: os diretórios e padrões serverless são resolvidos automaticamente.

O commit não envia PDFs, `.env`, banco, índices, modelos ou relatórios locais. Adicionar documentos ao disco local não os disponibiliza na hospedagem. Envie-os manualmente à aplicação publicada e indexe no banco de destino.

As verificações automatizadas usam fixtures e clientes simulados, sem chamada paga ao provedor. Teste manualmente a aplicação com suas credenciais e seu acervo para validar a integração real.

## Documento preso em Processando

A indexação salva trechos e vetores em lotes (`EMBEDDING_BATCH_SIZE=8`, `EMBEDDING_THREADS=1` por padrão). Isso limita o pico de memória do ONNX. Cada lote grava seu progresso no banco; após esgotar o orçamento da função, o documento fica pendente e a próxima chamada continua pelos vetores faltantes.

Se a Vercel encerrar a função à força, a consulta de status recupera documentos antigos em processamento depois que a trava expira. Atualize Documentos e use Indexar pasta para retomar o arquivo já armazenado; não é necessário enviá-lo novamente. Lotes parciais não são disponibilizados para respostas até concluir o documento.

A interface continua os lotes de uploads e reindexações síncronas enquanto estiver aberta. Os logs registram `lote_indexado` com contagem real de trechos. A dependência fontTools dá suporte às fontes CFF/Type1 de PDFs comprimidos.
