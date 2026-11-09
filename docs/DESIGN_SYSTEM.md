# Design system - Lume, Escola de trânsito

Revisado em 09/11/2026. Tokens em apps/mobile/src/theme/tokens.ts; componentes base em src/components/ui; marca e ilustração em TrafficIdentity.tsx.

## Direção visual

Verde de lousa para ações e identidade, amarelo de sinalização como destaque decorativo, superfícies de papel e bordas suaves. A associação com escola acontece pelo livro, pela placa de escola e pela linguagem de aprendizado; não há promessa de formação, prova oficial ou habilitação.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| background | #F6F5EE | #101C17 | Papel / fundo geral |
| surface | #FFFFFF | #182820 | Cards e campos |
| surfaceMuted | #EDEFE5 | #22362B | Trechos e apoio |
| textPrimary | #19382F | #F5F5E9 | Leitura principal |
| textSecondary | #53645B | #B6C8B9 | Legendas |
| primary | #1C6048 | #9DD8B4 | Ações |
| primaryStrong | #154A38 | #B8E9C7 | Ênfase |
| primarySoft | #E4F0E5 | #233E2D | Perguntas e seleção |
| border | #DCE2D5 | #304A39 | Contornos |
| borderStrong | #A0AFA0 | #58735F | Campos |
| accent | #EFC64B | #F2CB59 | Sinalização decorativa |
| board | #163F34 | #193D2F | Painel de abertura e marca |
| boardText | #FFFDF2 | #FFFDF2 | Texto sobre lousa |
| boardMuted | #CCDFD0 | #CCDFD0 | Apoio sobre lousa |

Success, warning, danger e info continuam reservados a estados reais, sempre com texto. As três luzes da marca são ilustração decorativa; o estado de conexão permanece em um selo separado.

## Tipografia e composição

Fontes do sistema; display 34/42 com peso 800, título 22/30, subtítulo 17/24 e corpo 16/24. O painel de abertura usa 38/46 no espaço amplo e 29/36 no compacto. Raios 8/12/20 e pílula 999; espaçamento 4-48 px. Largura de página 1240 px e de leitura 760 px.

A faixa Escola de trânsito identifica os cabeçalhos. Os cartões deixam espaço para leitura e as ações existentes mantêm foco e estados desabilitados. Elementos não dependem de hover.

## Componentes

| Componente | Responsabilidade visual |
|---|---|
| TrafficMark | Marca com livro e sinalização, sem estado ou ação |
| StudyHero | Painel de abertura com placa escolar e faixa de pista |
| PageHeader / SectionHeader | Hierarquia e contexto |
| Card / StatCard | Conteúdo e indicadores reais |
| ChatMessage | Pergunta e resposta em blocos distintos; selo Assistente IA |
| SourceReference | Fonte, página, trecho e ações de conferência; sem score |
| MetadataTable | Dados úteis do original; sem ID interno e origem técnica |
| ConnectionBadge | Tudo pronto, atenção ou falta de conexão |
| AppShell | Mesmas rotas, menu adaptativo e grupo da equipe |
| Button / IconButton / TextField / Dialog | Controles e confirmações existentes |

A arte geométrica usa Views e Ionicons existentes. Não há novos pacotes, download de fontes, imagem remota ou animação ornamental. As cores da ilustração são decorativas; os textos e ações usam tokens semânticos.

## Acessibilidade e integridade

Texto sobre fundos principais com contraste mínimo de 4,5:1, foco visível, rótulos de ícones, estados por texto e área de toque preservados. Os testes incluem os pares boardText/board, boardMuted/board e accent/board. O tema não muda a classificação dos estados nem os dados da API.

## Microcopy

Preparar documentos corresponde à ação anterior Indexar pasta; Preparar novamente à reindexação. Biblioteca, fontes e consultas usam termos cotidianos. Parâmetros editáveis continuam em Ajustes do acervo, destinados à equipe; nomes de variáveis, scripts e infraestrutura ficam na documentação técnica.
