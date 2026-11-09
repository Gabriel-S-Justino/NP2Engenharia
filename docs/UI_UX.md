# UI/UX - Lumme, Escola de trânsito

Atualização de apresentação em 09/11/2026. O Lumme aproxima o estudo das leis de trânsito da experiência de uma escola: orientação clara, materiais de apoio e fontes acessíveis. Esta revisão não altera regras de negócio, rotas, condições de habilitação, validações ou processamento.

## Identidade e público

Motoristas iniciantes, estudantes e pessoas que querem compreender as regras de circulação. A linguagem é acolhedora e direta, sem infantilizar. Verde de lousa, amarelo de sinalização e fundo claro de papel conectam trânsito e aprendizado. O tema escuro mantém a mesma identidade.

A sinalização ilustrada e o livro são decorativos. Não representam progresso, aprovação, semáforo real, habilitação ou recomendação para agir no trânsito.

## Telas e navegação

| Rota mantida | Nome atual | Conteúdo |
|---|---|---|
| / | Início / Seu ponto de partida | Apresentação, materiais na biblioteca, documentos prontos e dúvidas respondidas |
| /chat | Tire suas dúvidas | Pergunta, resposta, avisos e fontes clicáveis |
| /documentos | Sua biblioteca | Enviar arquivo, Preparar documentos, Preparar novamente, filtros, busca e remoção |
| /documentos/[id] | Detalhe do material | Informações do documento, cuidados e trechos para consulta |
| /fontes | Fontes para conferir | Documento, página, texto original e autoria disponível |
| /testes | Revisão de qualidade | Mesmas avaliações, filtros, resultados e registro de ajustes |
| /mentoria | Diário da equipe | Mesmos campos e registros de validação |
| /configuracoes | Configurações | Disponibilidade, ajustes do acervo, token, privacidade e aparência |

No desktop, as opções principais são identificadas como Aprender e consultar; as opções de revisão, diário e configurações aparecem no Espaço da equipe. Nenhuma rota foi removida ou protegida por um novo requisito. No celular, a navegação abre em um menu lateral à esquerda pelo botão no topo. No tablet, a sidebar continua recolhida por padrão.

## Informação útil na consulta

Permanecem visíveis: pergunta, resposta, origem do trecho, página, acesso à fonte, ausência de informação, divergências, citações inválidas e falhas. Dados ausentes continuam como Não informado ou -.

Saem da apresentação de consulta: scores de similaridade, top-k, limiar, candidatos descartados, métricas de latência, nome do modelo, banco, fingerprints, identificadores internos, offsets de caracteres e caminhos de desenvolvimento. A API preserva esses campos.

A página inicial deixa de funcionar como painel técnico. Ela apresenta materiais e acesso à conversa, com a mesma condição anterior: a conversa só fica habilitada quando existe documento processado.

A revisão e o diário continuam sendo ferramentas da equipe, sem se apresentarem como prova de direção, quiz ou avaliação do aluno. Não foram criados pontos, certificados, aulas, ranking ou progresso fictício.

## Textos dos estados

| Código original | Rótulo atual |
|---|---|
| processed | Pronto para consulta |
| pending | Na fila |
| processing | Preparando |
| failed | Precisa de atenção |
| excluded | Não utilizado |
| conexão online | Tudo pronto |
| provider_error | O assistente precisa de um momento |
| index_unavailable | Acervo temporariamente indisponível |

Os códigos e as decisões permanecem iguais. A função de apresentação apenas simplifica alguns termos e remove códigos HTTP da mensagem visual. Falhas e avisos continuam sendo apresentados; os dados originais não são regravados.

## Interações preservadas

Enviar, repetir e limpar perguntas; navegar até a fonte; expandir trechos; enviar arquivos; preparar e reprocessar documentos; filtrar e paginar; confirmar remoção; executar avaliações; registrar ajustes; salvar diário; salvar/remover token; alterar parâmetros e tema continuam com os mesmos handlers.

Não foram acrescentados modais, etapas obrigatórias, assistentes de onboarding ou atalhos que enviam perguntas automaticamente.

## Responsividade e acessibilidade

Breakpoints preservados: 400, 768 e 1024 px. Conteúdo geral até 1240 px; leitura até 760 px; painel de fontes no chat desktop com 360 px. Cards e ações quebram em linhas; a ilustração maior não ocupa a versão compacta.

Os pares de contraste são verificados nos temas claro e escuro, incluindo texto de lousa e amarelo sobre o painel. Estados usam texto além da cor. Foco, links reais, rótulos de botões, redução de movimento, confirmações e escala de fonte permanecem. Ilustrações decorativas ficam fora da leitura assistiva.

## Documentação e evidências

Design detalhado em [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md); operações em [FLUXOS_UX.md](FLUXOS_UX.md); contrato preservado em [CONTRATO_FRONTEND.md](CONTRATO_FRONTEND.md). Relatórios e capturas anteriores são registros históricos, não prova da aparência atual. A validação desta revisão está em [REVISAO_UI_2026-11-09.md](REVISAO_UI_2026-11-09.md).


## Nome e escrita

O nome público do aplicativo é Lumme. A interface, os metadados visíveis da aplicação, a identificação da API e os textos do projeto usam essa marca. Textos mantidos pelo aplicativo não usam travessões; usam pontuação simples e hífen quando necessário.

O domínio de produção atual, os identificadores de pacote e de instalação e o prefixo de armazenamento local permanecem iguais para preservar links, instalação, preferências, token e histórico existentes. Esses identificadores técnicos não são o nome apresentado ao usuário. Documentos enviados pelos usuários e capturas históricas não são reescritos.


## Histórico de chats

O histórico fica diretamente na sidebar, no padrão de navegação de aplicações de chat: Nova conversa no topo, busca, lista compacta com rolagem e destaque da conversa atual. No celular, o menu abre pela esquerda; no desktop, pode ser recolhido. Ferramentas da equipe expande os links de revisão e diário; Configurações permanece no rodapé. A busca usa os títulos das conversas. A lista pertence ao navegador ou dispositivo. Trocar de chat preserva as fontes e permanece bloqueado durante envio ou carregamento. [Detalhes e limitações](HISTORICO_CHATS.md).
