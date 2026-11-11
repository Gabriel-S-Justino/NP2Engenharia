# Matriz de testes

A meta de aprovação é 80%. Resultados não são ajustados manualmente.

## Acervo real

Na tela **Revisão de qualidade**, clique em **Executar testes** para rodar a matriz real. A tela e a API exibem apenas execuções dessa matriz, inclusive no histórico e no indicador da página inicial.

tests/acceptance/matriz_acervo_real.json contém seis perguntas com informação presente, duas com informação ausente, uma fora do escopo e uma adversarial. As respostas esperadas foram conferidas nos trechos indexados do CTB existente. Hash, edição e páginas físicas estão na proveniência da matriz. Cada execução recupera trechos do documento de referência conferido pelo hash. Para avaliar, esse documento precisa estar processado no acervo real.

A avaliação exige status answered, citações válidas, fonte e página esperadas, termos esperados na resposta e na evidência. Alternativas explícitas usam |, por exemplo 30|trinta. São critérios automáticos auxiliares, sem substituir leitura humana.

A execução de 10/11/2026 no deployment do commit e9077366 obteve 9/10. A pergunta sobre validade da permissão retornou evidência insuficiente. Foi uma linha de base com FastEmbed e Gemini reais, anterior às novas contas e memória. [Relatório](resultados/acervo_real_real_2d891ced724e.md).

tests/acceptance/calibracao_real.json contém perguntas independentes verificadas no mesmo documento. Preparar perguntas não significa ter calibrado o índice: nenhuma nova calibração semântica foi promovida nesta entrega.

## Regressão de aplicação

Testes backend cobrem JWT, algoritmo, emissor, público, expiração, acesso anônimo, isolamento entre usuários, vínculo administrativo de histórico, exclusão, feedback, memória limitada e cotas concorrentes. Migração e cotas também são verificadas em branch Neon isolada.

Testes frontend cobrem restauração do catálogo, troca de conta, descarte de respostas atrasadas, bloqueio do visitante, exclusão com falha e paginação. Também permanecem os testes anteriores de componentes, chat, contrato e validação.

Comandos: npm run backend:test, npm run frontend:test, npm run frontend:build. Em apps/mobile: npm run lint e npm run typecheck.

A CI executa a suíte de regressão em um ambiente isolado. Os resultados dessa suíte são independentes da Revisão de qualidade.
