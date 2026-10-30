# UI/UX — Acervo IA

## Objetivos da experiência
Confiança, clareza, precisão e transparência. Princípio central: **cada resposta precisa ser compreensível,
verificável e acompanhada de suas evidências.** A interface nunca sugere que a IA é infalível.

## Público e problema
Motoristas iniciantes e interessados em leis de trânsito, majoritariamente em celular, com pouca familiaridade
com textos normativos. Problema: localizar a regra certa em vários PDFs longos sem perder a origem da informação.

## Princípios de design
1. **Evidência visível:** resposta e evidências em blocos distintos ("RESPOSTA" × "EVIDÊNCIAS CITADAS"); rótulos
   [F1] clicáveis; painel lateral (desktop) ou painel inferior (celular).
2. **Honestidade:** sem percentuais de "confiança" inventados; "Similaridade 0,53" com legenda de que não é
   probabilidade; avisos para evidência fraca, divergência e insuficiência; modo demonstração identificado.
3. **Dados reais apenas:** indicadores vêm da API; ausência = "—"/"Não informado"/"Ainda não avaliado".
4. **Estado sempre explícito:** carregando, vazio, erro (o que houve, o que fazer, se dá para repetir), sucesso.
5. **Sobriedade:** cores frias, contraste verificado, poucos efeitos; animação só para mudança de estado.

## Arquitetura de informação

| Rota | Tela | Objetivo |
|---|---|---|
| `/` | Visão geral | Estado do acervo, conexão, avaliação e atalho para perguntar |
| `/chat` | Assistente documental | Perguntar e verificar evidências (tela prioritária) |
| `/documentos` | Biblioteca | Enviar, indexar, filtrar, reindexar e remover documentos |
| `/documentos/[id]` | Detalhe do documento | Metadados e trechos indexados |
| `/fontes` (`?source=`) | Fontes e evidências | Rastrear a origem de um trecho citado |
| `/testes` | Laboratório de avaliação | Executar a matriz, ver resultados e registrar ajustes |
| `/mentoria` | Diário da IA mentora | Registrar validações reais |
| `/configuracoes` | Configurações | Parâmetros, conexão, token, privacidade, tema |

## Navegação e responsividade

| Breakpoint | Largura | Navegação | Layout |
|---|---|---|---|
| mobileNarrow | < 400 px | Barra inferior (Início, Chat, Acervo, Fontes, Mais) | Coluna única, padding 16 |
| mobileWide | 400–767 px | Barra inferior | Coluna única |
| tablet | 768–1023 px | Sidebar **recolhida** (ícones), expansível | Grades com quebra |
| desktop | ≥ 1024 px | Sidebar expandida, recolhível | Conteúdo até 1120 px; chat com painel de evidências de 420 px |

"Mais" abre um painel inferior com Avaliação, Diário e Configurações. A tela atual é indicada por cor, peso da
fonte, ícone preenchido e `aria-current="page"`. A conversa vive no estado global: trocar de tela não a apaga, e o
histórico é recuperado do backend ao reabrir (identificador salvo no dispositivo).

## Hierarquia visual
Título da página (display/título) → descrição → ações primárias à direita (desktop) ou abaixo (celular) → cartões
de indicadores → conteúdo. No chat: pergunta do usuário (fundo primário suave, à direita) → cartão da resposta com
selos (modo de geração, nível de evidência, latência) → aviso → resposta → evidências.

## Estados por tela (implementados)

| Tela | Estados |
|---|---|
| Chat | conversa vazia; carregando histórico; envio em andamento (botão bloqueado, prevenção de duplicidade); resposta; evidência fraca; fontes divergentes; sem evidência; fora do escopo; instrução maliciosa ignorada; nenhum documento indexado (envio desabilitado); erro de conexão/timeout com "Tentar novamente"; provedor de IA indisponível (mostra trechos); citações inválidas; índice indisponível |
| Documentos | carregando (skeleton); vazio; erro; aguardando; processando com progresso real (n de m); lotes pendentes na Vercel ("Lote N concluído, X pendente(s)", continuação automática); processado; falha com motivo; fora do índice; upload em andamento/concluído; arquivo não suportado; acima do limite; duplicado; confirmação de remoção e de reindexação |
| Fontes | lista; filtro por tipo; detalhe; falha ao recuperar fonte; metadados "Não informado" |
| Avaliação | "Ainda não avaliado"; executando; resultados; abaixo/acima da meta; somente falhas; suíte não pronta; registro de ajuste |
| Configurações | leitura; edição validada; confirmação de reindexação; token; backend offline; endereço "mesma origem"; banco/armazenamento persistente e modo serverless |

## Acessibilidade (WCAG 2.2 AA como referência)
- Contraste de todos os pares texto/fundo ≥ 4,5:1 nos dois temas — **verificado por teste automatizado**
  (`src/__tests__/tokens.test.ts`); o teste encontrou e corrigiu o texto desabilitado (4,13:1 → ≥ 4,7:1).
- Foco visível (contorno de 2–3 px) em botões, campos e itens de navegação; navegação por Tab + Enter testada no
  E2E (encontrou e corrigiu um defeito: itens do menu não respondiam a Enter).
- Itens de navegação são links reais (`<a href>`) na web.
- Rótulos acessíveis em todos os botões de ícone; papéis `heading` com nível, `alert`, `progressbar`, `dialog`.
- Erros associados aos campos (`aria-describedby`, `aria-invalid`) e anunciados (`accessibilityLiveRegion`).
- Estados nunca só por cor (selo com texto e ícone). Áreas de toque ≥ 44 px. Fonte escala até 160%.
- Skeleton respeita "reduzir movimento".
- **Não verificado:** leitores de tela reais (NVDA/VoiceOver/TalkBack) e dispositivos físicos.

## Justificativas de UX
- **Painel de evidências** ao lado da conversa no desktop: verificar sem perder o contexto; no celular, as
  evidências aparecem compactas sob cada resposta, com expansão do trecho, e "Ver painel de evidências" em sheet.
- **Recusa como resposta legítima:** o estado "sem evidência" tem o mesmo peso visual de uma resposta, com
  explicação, para que o usuário não interprete como erro.
- **Sugestões de perguntas não são inventadas:** o estado inicial explica o que perguntar sem citar documentos
  que podem não existir no acervo.
- **Operações destrutivas** sempre com diálogo de confirmação; remover documento de `Documentos/` explica que o
  arquivo original é preservado.
