# Contrato frontend e API

O contrato completo é gerado pelo FastAPI em /api/openapi.json. Erros mantêm o envelope existente. Rotas públicas de acervo continuam disponíveis; operações administrativas exigem X-Admin-Token.

## Contas

| Método | Caminho | Controle | Resultado |
|---|---|---|---|
| GET | /api/auth/config | Público | URL pública do Neon Auth e configured |
| GET | /api/account/me | Bearer JWT | Identidade validada |
| GET | /api/account/usage | Bearer JWT | daily_used, daily_limit, minute_used, minute_limit, resets_at |

Na web publicada, o SDK usa a origem do Lumme. O servidor encaminha somente as operações de conta abaixo ao Neon Auth. Os erros preservam o código e o status do provedor quando a resposta é JSON.

| Método | Caminho em /api/auth | Finalidade |
|---|---|---|
| GET | get-session | Restaurar a sessão e receber o JWT emitido pelo Neon |
| POST | sign-up/email | Criar conta |
| POST | sign-in/email | Entrar com e-mail e senha |
| POST | sign-out | Encerrar sessão |
| POST | email-otp/request-password-reset | Solicitar código de recuperação |
| POST | email-otp/reset-password | Validar código e trocar senha |

Os POSTs exigem a mesma origem da aplicação. As respostas de sessão usam `Cache-Control: no-store, private` e cookies `Secure`, `HttpOnly` e `SameSite=Lax`. O acesso nativo e o desenvolvimento com frontend e API em origens distintas usam a URL gerenciada do Neon Auth.

## Revisão de qualidade

| Método | Caminho | Resultado |
|---|---|---|
| GET | /api/evaluations | Matriz real, histórico e execução atual |
| POST | /api/evaluations/run | Executa a matriz do acervo real com autorização administrativa |
| GET | /api/evaluations/results | Resultados da última avaliação real ou do run_id informado |
| POST | /api/evaluations/results/{run_id}/cases/{case_id}/adjustment | Registra ajuste de um caso da matriz real com autorização administrativa |

O identificador de suíte aceito pela API é `acervo_real`. Ele é o padrão da execução e da consulta de resultados. IDs de outras suítes retornam 404 na consulta por execução. O indicador de avaliação em `/api/stats` usa a última avaliação real concluída.

## Conversas

| Método | Caminho | Resultado |
|---|---|---|
| GET | /api/conversations?offset=0&limit=100 | items com id, title, updated_at e has_more |
| PATCH | /api/conversations/{id} | Renomeia com title entre 1 e 100 caracteres |
| GET | /api/conversations/{id}/export | filename e content Markdown |
| POST | /api/conversations/import-legacy | conversation_ids, retorna imported; exige também admin |
| POST | /api/chat | Contrato anterior, agora exige conta; ID é verificado ou criado |
| GET | /api/chat/history/{id} | Mensagens paginadas e has_more |
| DELETE | /api/chat/history/{id} | Exclusão da conversa e total removido |
| POST | /api/chat/feedback/{interaction_id} | rating 1 ou -1, comment opcional até 1.000 caracteres |

Todas exigem Bearer JWT. Toda operação com ID confere propriedade no backend. 401 indica sessão ausente ou inválida; 404 evita revelar conversas de terceiros; 429 indica cota atingida. ADMIN_TOKEN sozinho não libera o chat.

Stats inclui corpus_notice opcional. ChatResponse mantém seus campos; histórico limitado é montado no servidor, sem o frontend enviar textos anteriores. A exportação só inclui a conversa autorizada. Respostas privadas não devem ser armazenadas em cache compartilhado.
