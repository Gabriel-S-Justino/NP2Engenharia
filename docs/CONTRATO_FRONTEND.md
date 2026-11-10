# Contrato frontend e API

O contrato completo é gerado pelo FastAPI em /api/openapi.json. Erros mantêm o envelope existente. Rotas públicas de acervo continuam disponíveis; operações administrativas exigem X-Admin-Token.

## Contas

| Método | Caminho | Controle | Resultado |
|---|---|---|---|
| GET | /api/auth/config | Público | URL pública do Neon Auth e configured |
| GET | /api/account/me | Bearer JWT | Identidade validada |
| GET | /api/account/usage | Bearer JWT | daily_used, daily_limit, minute_used, minute_limit, resets_at |

Senhas e códigos de recuperação são enviados diretamente ao Neon Auth pelo SDK oficial.

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
