# Fluxos de UX

## 1. Primeira utilização
```mermaid
flowchart TD
  A[Abrir o app] --> B{Backend conectado?}
  B -- não --> E[ErrorState: verificar serviço / endereço em Configurações]
  B -- sim --> C{Há documentos processados?}
  C -- não --> D[Visão geral: 'Seu acervo ainda está vazio' → Abrir biblioteca]
  D --> F[Documentos: Indexar pasta ou Enviar arquivo]
  F --> G[Indexação concluída] --> H[Assistente habilitado]
  C -- sim --> H
```

## 2. Adição e indexação de documentos
```mermaid
flowchart TD
  A[Enviar arquivo] --> B{Tipo e tamanho válidos no cliente?}
  B -- não --> X[Toast: não suportado / acima do limite]
  B -- sim --> C[POST /api/documents/upload]
  C --> D{Backend valida conteúdo real, duplicata, token}
  D -- erro --> Y[Toast com mensagem pública: 415/409/413/403]
  D -- ok --> E[Documento 'Aguardando' + indexação iniciada]
  E --> F[Polling /api/ingestion/status: progresso n de m]
  F --> G{Resultado}
  G -- processado --> H[Selo 'Processado' + n trechos]
  G -- falha --> I[Selo 'Falha' + motivo]
```
Indexar a pasta segue o mesmo caminho a partir de `POST /api/ingestion/scan`.

## 3. Envio de uma pergunta
```mermaid
flowchart TD
  A[Digitar pergunta] --> B{Vazia ou > 1000 caracteres?}
  B -- sim --> C[Erro no campo]
  B -- não --> D[Bloqueia envio duplicado + 'Buscando trechos…']
  D --> E[POST /api/chat]
  E --> F{Status}
  F -- answered --> G[Fluxo 4]
  F -- insufficient/out_of_scope --> H[Fluxo 5]
  F -- blocked --> I[Aviso: instruções ignoradas]
  F -- erro de rede/timeout --> J[Fluxo 6]
```

## 4. Resposta com fontes
```mermaid
flowchart LR
  A[Resposta] --> B[Selos: modo de geração, nível de evidência, latência]
  A --> C[Texto com rótulos F1, F2]
  C -- toque no rótulo --> D[Fontes: detalhe do trecho]
  A --> E[Evidências citadas: documento, página, trecho, similaridade]
  E --> F[Detalhes da fonte]
  A --> G[Desktop: painel lateral com candidatos e motivos]
```

## 5. Pergunta sem evidências suficientes
```mermaid
flowchart TD
  A[Backend: nenhum trecho acima do limiar\nou termo central ausente] --> B[status insufficient_evidence / out_of_scope]
  B --> C[Notice: 'Não encontrei evidências suficientes…' + maior similaridade e limiar]
  C --> D[Sem resposta factual e sem citações]
  D --> E[Usuário reformula ou consulta Documentos]
```

## 6. Falha de conexão
```mermaid
flowchart TD
  A[fetch falha ou excede o tempo] --> B[ApiError network/timeout]
  B --> C[Mensagem: 'Não foi possível conectar ao serviço…']
  C --> D{Repetível?}
  D -- sim --> E[Botão 'Tentar novamente' reenvia a MESMA pergunta]
  D -- não --> F[Somente a mensagem]
  G[Health check a cada 30 s] --> H[Selo de conexão: Conectado / Com alertas / Indisponível]
```

## 7. Execução dos testes
```mermaid
flowchart TD
  A[Laboratório: escolher suíte] --> B{Suíte pronta?}
  B -- não --> C[Botão desabilitado + instrução para preencher a matriz]
  B -- sim --> D[POST /api/evaluations/run]
  D --> E[Polling GET /api/evaluations até concluir]
  E --> F[Taxa, por categoria, métricas de recuperação, casos]
  F --> G{Falhou algum caso?}
  G -- sim --> H[Registrar ajuste → corrigir → executar de novo]
```

## 8. Remoção de documentos
```mermaid
flowchart TD
  A[Ícone remover] --> B[ConfirmDialog explica o efeito]
  B -- cancelar --> Z[Nada muda]
  B -- confirmar --> C[DELETE /api/documents/id]
  C --> D{Origem}
  D -- upload --> E[Remove vetores, trechos, registro e arquivo enviado]
  D -- Documentos/ --> F[Remove vetores e trechos; arquivo original preservado; estado 'Fora do índice']
  F --> G[Reindexar o documento o reinclui]
```
