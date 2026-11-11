# Estado de produção

Atualizado em 11/11/2026.

A aplicação usa Vercel, Neon Postgres/pgvector, FastEmbed e Gemini. A URL pública é https://lumme.vercel.app. Credenciais continuam somente no servidor.

Esta entrega adiciona contas Neon Auth, histórico por proprietário, memória limitada, ações de chat, feedback e cotas persistidas. Migrações são aditivas. Conversas antigas ficam protegidas até vínculo administrativo.

## Pré-requisitos

- DATABASE_URL para Postgres com pgvector.
- LLM_PROVIDER=gemini e LLM_API_KEY válida.
- NEON_AUTH_BASE_URL ou DATABASE_NEON_AUTH_BASE_URL apontando ao serviço gerenciado.
- Origem de produção autorizada no Neon Auth e CORS.
- ADMIN_TOKEN forte para acervo e avaliações.
- Retenção e limites adequados ao público do serviço.

O serviço de autenticação já existe no projeto Neon e aceita as origens lumme.vercel.app e acervoia.vercel.app. Não é necessário colocar a chave LLM no navegador.

## Recuperação de senha

Em 11/11/2026, cadastro, entrada, saída e restauração de sessão foram validados no Chromium com uma branch Neon isolada e acesso direto ao domínio do Neon bloqueado no navegador. A solicitação de código retornou HTTP 200. O código não chegou à caixa postal temporária durante a validação, com o remetente compartilhado `auth@mail.myneon.app`.

Para configurar a entrega de e-mail, abra **Settings → Better Auth** no projeto Neon de produção e selecione **Custom SMTP provider**. Use o host, a porta, as credenciais e o remetente verificado fornecidos pelo serviço de e-mail da equipe. Grave as credenciais diretamente no painel do Neon.

Após salvar, solicite um código pelo Lumme com uma conta de teste que tenha acesso à caixa postal. Confirme o recebimento, troque a senha e entre novamente. Registre o resultado sem incluir senha ou código. Um HTTP 200 na solicitação confirma o aceite do pedido.

[Configuração de SMTP na documentação do Neon](https://neon.com/docs/auth/production-checklist#email-provider).

## Validação

Os testes automatizados usam identidades controladas e não equivalem a testar entrega de e-mail ou todos os navegadores. A migração e cotas também são conferidas em branch Neon isolada. O relatório de acervo real identifica o commit anterior avaliado.

Antes de divulgar amplamente, configure remetente próprio, confira recuperação por e-mail, homologue navegadores e dispositivos alvo e atualize o material legal antigo. Nenhuma dessas pendências é escondida por métricas de testes sintéticos.

Veja [Deploy Vercel](DEPLOY_VERCEL.md), [Variáveis](VARIAVEIS_AMBIENTE.md), [Testes de produção](TESTES_PRODUCAO.md) e [Rollback](ROLLBACK.md).
