# Arquitetura do Lumme

Frontend Expo Router e React Native Web publicado na Vercel. API FastAPI em Python. PostgreSQL com pgvector no Neon guarda documentos, originais, trechos, vetores, interações, avaliações, propriedade de conversas, feedback e contadores de consumo. SQLite e FAISS permanecem disponíveis em ambientes controlados.

## Fluxo da pergunta

1. SDK Neon Auth obtém a sessão e um JWT.
2. API valida identidade e reserva cotas no banco.
3. A conversa é criada ou sua propriedade é verificada.
4. São recuperadas respostas anteriores da mesma conversa dentro do orçamento de contexto.
5. Referências da pergunta podem incluir o assunto anterior na busca.
6. Recuperação vetorial, verificação de suficiência, geração Gemini e validação de citações produzem a resposta.
7. Interação é persistida e o catálogo da conta é atualizado.

O histórico ajuda a interpretar a pergunta, sem substituir evidências atuais. Recusas e falhas continuam explícitas. O acervo contém uma edição antiga do CTB; uma advertência acompanha a consulta quando o documento conferido está processado.

## Dados e migrações

Migrações aditivas versionadas criam chat_conversations, chat_feedback e usage_buckets. Não atribuem automaticamente conversas anônimas a contas. O vínculo administrativo é explícito e não transfere conversas existentes de dono.

A exclusão elimina mensagens e feedbacks, mas mantém uma marca do ID excluído. Cotas usam incrementos condicionais e transação, garantindo limites entre instâncias. Consultas privadas verificam owner_id no servidor.

A indexação existente mantém lotes e retomada, sem carregar modelos ou originais no frontend. A inicialização não executa avaliações reais automaticamente.

Consulte [Contrato](CONTRATO_FRONTEND.md), [Contas](CONTAS_E_CONVERSAS.md) e [Matriz de testes](MATRIZ_TESTES.md).
