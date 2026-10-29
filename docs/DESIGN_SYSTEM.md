# Design system

Código: `apps/mobile/src/theme/tokens.ts` (tokens), `ThemeProvider.tsx` (tema claro/escuro/sistema),
`src/components/ui/` (componentes base) e `src/components/` (componentes de domínio).

## Cores (tokens semânticos)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| background | `#F6F8FC` | `#0B1020` | Fundo da página |
| surface | `#FFFFFF` | `#121A2B` | Cartões, campos |
| surfaceElevated | `#FFFFFF` | `#1B263A` | Diálogos |
| surfaceMuted | `#EEF2F8` | `#172238` | Trechos, skeleton |
| textPrimary | `#172033` | `#F1F5F9` | Texto principal |
| textSecondary | `#556275` | `#A3B2C7` | Texto auxiliar (ajustado de `#64748B` para garantir ≥ 4,5:1 sobre o fundo) |
| primary / primaryStrong / primarySoft | `#4F46E5` / `#3730A3` / `#EEF0FF` | `#818CF8` / `#A5B4FC` / `#1E2447` | Ações, item ativo |
| border / borderStrong | `#E2E8F0` / `#B8C2D1` | `#29364B` / `#3B4A63` | Divisórias / contorno de campos |
| success, warning, danger, info (+Soft) | `#15803D`, `#B45309`, `#B91C1C`, `#0E6A8A` | `#4ADE80`, `#FBBF24`, `#F87171`, `#67C7E8` | Estados |
| evidence / evidenceSoft | `#0F766E` / `#E6F4F2` | `#5EEAD4` / `#0F2A2A` | Identidade visual das fontes e citações |
| focus | `#4F46E5` | `#A5B4FC` | Contorno de foco |
| disabled / disabledText | `#E2E8F0` / `#5B6676` | `#22304A` / `#9AA8BC` | Controles desabilitados |

A cor **evidence** (verde-azulado) é exclusiva de fontes/citações, diferenciando "de onde veio" de "ação".

## Tipografia
Fontes do sistema (sem download). Escala: display 30/38 bold · title 22/30 bold · subtitle 17/24 semibold ·
body 16/24 · bodyStrong 16/24 semibold · helper 14/20 · caption 13/18 medium · mono 13/18 (identificadores).
`maxFontSizeMultiplier = 1.6` mantém o layout com fontes ampliadas.

## Espaçamento, bordas, elevação e outros tokens
- Espaçamento: 4, 8, 12, 16, 24, 32, 40, 48 (`xxs`…`xxxl`).
- Raios: 6 (sm), 10 (md), 14 (lg), 999 (pill). Elevação: `none`, `low` (cartões), `medium` (diálogos, toasts).
- Ícones (Ionicons): 16, 20, 24, 32. Altura de controles: 36, 44 (padrão, área de toque), 52.
- Larguras máximas: leitura 760, página 1120. Breakpoints: 0, 400, 768, 1024. Durações: 120, 200, 320 ms.

## Componentes
| Componente | Arquivo | Notas |
|---|---|---|
| AppText | `ui/AppText.tsx` | Variantes tipográficas, cor por token, `headingLevel` |
| Button, IconButton | `ui/Button.tsx` | primary/secondary/ghost/danger; carregando; desabilitado; foco visível; IconButton exige rótulo |
| TextField (TextInput, TextArea, SearchInput) | `ui/TextField.tsx` | Rótulo, ajuda, erro associado, contador |
| Card, PageContainer, PageHeader, SectionHeader, Row | `ui/Layout.tsx` | Estrutura responsiva |
| Badge, FilterChip | `ui/Badge.tsx` | Estado com texto + cor (+ ícone) |
| Dialog (modal / bottom sheet / painel lateral), ConfirmDialog | `ui/Dialog.tsx` | `variant="sheet"` vira painel inferior no celular e lateral no desktop |
| ToastProvider/useToast | `ui/Toast.tsx` | Feedback anunciado a leitores de tela |
| EmptyState, ErrorState, LoadingState, Skeleton, ProgressIndicator, Notice | `ui/Feedback.tsx` | Progresso só com dados reais |
| StatCard | `ui/StatCard.tsx` | Valor ausente = "—" |
| SourceReference, CitationChip (rótulo [F1] em FormattedText) | `SourceReference.tsx`, `FormattedText.tsx` | Componente central de rastreabilidade |
| UserMessage, AssistantMessage, ConfidenceNotice, FailedMessage | `ChatMessage.tsx` | Separa resposta e evidências |
| DocumentCard, MetadataTable | `DocumentCard.tsx`, `MetadataTable.tsx` | "Não informado" para metadados ausentes |
| AppShell (Sidebar, BottomBar, NavigationItem), ConnectionBadge | `AppShell.tsx`, `ConnectionBadge.tsx` | Navegação adaptativa |

Tooltip não foi implementado: em toque não há hover; as informações ficam em texto visível ou `accessibilityHint`
(e `title` em botões de ícone na web).

## Estados visuais
Hover (web: cursor de ponteiro padrão do React Native Web; sem realce adicional — a informação nunca depende de hover), foco (contorno `focus`), pressionado (opacidade 0,85 / fundo `surfaceMuted`),
carregando (indicador + `busy`), desabilitado (`disabled`/`disabledText`), selecionado (fundo `primarySoft` +
ícone de check/ícone preenchido), erro (`danger` + mensagem).

## Regras de uso
- Componentes usam **somente tokens semânticos** (nunca hex direto, exceto branco do botão `danger`).
- Toda ação destrutiva usa `ConfirmDialog` com `destructive`.
- Todo ícone isolado usa `IconButton` com `accessibilityLabel`.
- Dados indisponíveis nunca viram zero.

## Exemplo
```tsx
<Card>
  <SectionHeader title="Base documental" />
  <Badge label="Processado" tone="success" />
  <SourceReference source={citationToSource(citation)} onOpen={(id) => router.push({ pathname: '/fontes', params: { source: id } })} />
  <Button label="Indexar pasta" icon="sync-outline" onPress={scan} loading={busy} />
</Card>
```
