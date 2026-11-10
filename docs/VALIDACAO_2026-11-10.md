# Validação da entrega de 10/11/2026

## Código

- Backend: 135 testes aprovados, sete testes Postgres antigos não executados por exigirem um banco descartável com recriação de schema.
- Frontend: 85 testes aprovados em dez suítes.
- Ruff, ESLint e TypeScript aprovados.
- Build web Expo exportado com sucesso.

As verificações usaram o código alterado em sandbox remoto. Nenhum arquivo do computador do usuário foi alterado.

## Integração

Uma branch Neon isolada recebeu as migrações aditivas. Propriedade de conversa e cotas persistidas foram conferidas em PostgreSQL. Tokens reais de duas contas de validação do Neon Auth foram utilizados contra a API: a conta dona acessa e renomeia, outra recebe 404 e o visitante recebe 401.

No Chromium remoto, foram verificados entrada, restauração após recarga, tela de consumo, saída, renomeação pela sidebar, exportação Markdown, cancelamento de exclusão e exclusão confirmada seguida de recarga. Esses testes usaram a branch isolada, sem reindexar ou alterar documentos de produção. O ambiente de teste não valida geração Gemini da versão nova nem entrega de código por e-mail.

A validação no navegador encontrou e corrigiu leitura incorreta do JWT do SDK e ausência de Authorization na URL paginada do catálogo. Há regressões automatizadas para ambos.

## Acervo e geração reais

O deployment e9077366 foi avaliado separadamente com os provedores reais configurados na produção. A matriz completa obteve 9/10, com falha no caso R-A4. Relatório: [acervo real](resultados/acervo_real_real_2d891ced724e.md). Esse resultado antecede a memória nova. Uma tentativa preliminar sem relatório completo teve respostas diferentes, indicando variabilidade; não se afirma estabilidade com esta amostra.

Nenhum original PDF foi baixado. As respostas esperadas foram conferidas nos trechos já indexados e o hash identifica a fonte. O material estava atualizado até junho de 2008.

## Homologação restante

Entrega de recuperação de senha, políticas de e-mail, domínio de autenticação, outros navegadores, acessibilidade com leitores de tela e aplicativos Android/iOS precisam de homologação específica. A calibração semântica não foi promovida. Essas limitações estão registradas em [Limitações](LIMITACOES.md).
