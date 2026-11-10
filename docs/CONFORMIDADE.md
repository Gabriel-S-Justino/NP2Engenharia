# Conformidade e evidências atuais

Atualizado em 10/11/2026.

| Requisito | Estado | Evidência ou limite |
|---|---|---|
| Consulta RAG com fontes e recusa | Implementado | Matriz real: 9 de 10 na linha de base e9077366 |
| Login e histórico por usuário | Implementado | Neon Auth, verificação JWT e propriedade em todas as rotas privadas |
| Memória da conversa | Implementado | Contexto limitado e escapado, sem transformar histórico em evidência |
| Ações do chat | Implementado | Renomear, exportar, excluir com confirmação, copiar e feedback |
| Limites compartilhados | Implementado | Transação no banco por conta, IP e serviço |
| Web em produção | Existente | Vercel com Neon Postgres e Gemini |
| Android e iOS | Homologação pendente | O build web não comprova funcionamento nativo |
| Acervo atualizado | Pendente | Arquivo conferido atualizado até junho de 2008 |
| Avaliação real | Executada na versão anterior | Amostra pequena, um caso falhou; relatório preservado |
| Calibração semântica nova | Não executada | Perguntas independentes preparadas, parâmetros não promovidos |
| Entrega de e-mail e navegadores alvo | Homologação pendente | Serviço de autenticação gerenciado usa remetente compartilhado |
| Documentação | Atualizada | Contrato, segurança, contas, operação, fontes e limitações |

A curadoria deve atualizar o material legal e conferir licenças e procedência. Papéis individuais de administrador, custos por tokens e sincronização em tempo real de abas não fazem parte desta entrega. Não se atribuem resultados de testes sintéticos ao acervo real.
