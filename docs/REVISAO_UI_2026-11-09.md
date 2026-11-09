# Revisão da interface — 09/11/2026

## Escopo

Revisão exclusiva de apresentação: tema de trânsito e escola, linguagem para estudantes, hierarquia visual, espaçamento e redução de ruído técnico. Não altera lógica de negócio, fluxos, rotas, autenticação, contratos, parâmetros, ingestão, busca, geração ou banco.

Verde de lousa, fundo de papel e amarelo de sinalização nos dois temas. Marca com livro e luzes, placa escolar e faixa de pista desenhadas com componentes existentes. Não foram adicionados pacotes, fontes externas, documentos ou dados demonstrativos.

## Apresentação

Início, Tire suas dúvidas, Biblioteca e Fontes formam a navegação de consulta. Revisão de qualidade, Diário da equipe e Configurações continuam disponíveis, identificados como espaço da equipe no desktop. O menu compacto mantém quatro opções e Mais.

A tela inicial usa os mesmos dados reais para materiais, documentos prontos e dúvidas respondidas. O botão de conversa mantém a condição original. Respostas continuam com avisos, citações, documento, página e trecho original. Saem do conteúdo voltado ao usuário scores, latências, modelos, IDs internos e detalhes de infraestrutura.

Todos os controles editáveis e ações administrativas permanecem. As mudanças de rótulo, como Preparar documentos, não modificam a operação correspondente. A normalização de mensagens ocorre somente na renderização; os dados originais não são regravados.

## Verificação

- TypeScript: aprovado.
- ESLint: aprovado.
- Jest: 65 testes aprovados em seis suítes.
- Contraste: temas claro e escuro, incluindo texto e destaque sobre a lousa.
- Build web Expo: aprovado.
- Comparação de atributos de interação via AST TypeScript: nenhuma diferença nos handlers onPress, onChangeText, onKeyPress, onConfirm, onCancel, onRetry, onClose, onOpen, onDelete, onReindex, onAdjust e onShowEvidence.
- Conferência no navegador: início em 1280 × 720 e 390 × 844; chat e menu compacto; navegação até configurações; seleção de tema claro; leitura dos temas claro e escuro sem sobreposição na abertura.
- As chamadas usadas na conferência visual consultaram dados existentes. Não houve upload, preparação de documentos, pergunta paga ou alteração de parâmetros.
- Seletores do smoke web atualizados para os novos rótulos. O roteiro completo de mutações desse smoke não foi executado nesta revisão.

A conferência visual não revalida o provedor de IA nem substitui os testes de integração do backend. Os relatórios de resultados anteriores mantêm seus números e passam a identificar sua interface como histórica.

## Documentação

Atualizados os guias de UI, design system, fluxos e contrato de apresentação; os guias operacionais, acadêmicos e históricos receberam notas de compatibilidade e nomes de navegação atuais. README principal e índice da documentação apontam para esta revisão. Instruções de execução e contratos técnicos foram preservados.

Veja [UI_UX.md](UI_UX.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [FLUXOS_UX.md](FLUXOS_UX.md) e [CONTRATO_FRONTEND.md](CONTRATO_FRONTEND.md).
