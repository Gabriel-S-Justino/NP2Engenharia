# Lumme

Escola de trânsito com consulta a documentos, respostas com fontes e histórico de conversas. A aplicação usa Expo Router na web, FastAPI, Neon Postgres com pgvector, FastEmbed e Gemini.

Produção: https://lumme.vercel.app

## Como usar

Crie uma conta em Sua conta e entre para perguntar. O token administrativo não é necessário para conversar. Na sidebar, inicie, busque e retome chats. O menu de cada chat permite renomear, exportar e excluir. Respostas podem ser copiadas e avaliadas.

O histórico fica na conta e aparece em outros dispositivos. A seleção do chat fica neste navegador. Conversas anônimas anteriores precisam de vínculo administrativo explícito. O contexto das últimas mensagens ajuda a interpretar perguntas de continuação, sempre exigindo evidências do acervo atual.

**O documento legal atualmente conferido foi atualizado até junho de 2008. Consulte o aviso da aplicação e confira normas atuais em fontes oficiais.** Esta entrega não baixa documentos reais.

## Configuração

No servidor, configure DATABASE_URL, LLM_PROVIDER=gemini, LLM_API_KEY, NEON_AUTH_BASE_URL (ou DATABASE_NEON_AUTH_BASE_URL) e ADMIN_TOKEN. A chave do Gemini e o token administrativo nunca entram no bundle público.

Autorize o domínio da aplicação no Neon Auth. O serviço existente já aceita os domínios públicos da aplicação. Consulte [Produção](docs/PRODUCAO.md) e [Variáveis de ambiente](docs/VARIAVEIS_AMBIENTE.md).

.env.example contém nomes e valores de referência, sem credenciais. O arquivo .env real não deve ser versionado.

## Desenvolvimento e verificações

Node e Python são necessários para os comandos do repositório:

```bash
npm run setup
npm run dev
npm run backend:test
npm run frontend:test
npm run frontend:build
```

Em apps/mobile, execute npm run lint e npm run typecheck. Configure Neon Auth inclusive em ambientes de desenvolvimento se quiser exercitar login real. Os testes automatizados usam identidades e documentos sintéticos controlados; eles não validam entrega de e-mail.

A avaliação real de 10/11/2026 usou o PDF já indexado, sem baixar o original, e obteve 9 de 10 casos na versão e9077366. O relatório identifica que se trata da linha de base anterior às novas contas e memória. [Relatório real](docs/resultados/acervo_real_real_2d891ced724e.md).

Documentação completa: [índice](docs/README.md). Limites e itens que precisam de homologação: [limitações](docs/LIMITACOES.md).
