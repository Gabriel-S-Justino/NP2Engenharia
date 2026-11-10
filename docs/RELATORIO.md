# Relatório do Lumme

Atualizado em 10/11/2026.

O Lumme permite estudar documentos de trânsito por perguntas, respostas com fontes e conversas persistidas. A identidade visual mantém o tema escola de trânsito.

## Entrega

Foram adicionados login e recuperação pelo Neon Auth, catálogo por usuário no servidor, memória contextual limitada, renomeação, exclusão, exportação Markdown, cópia de respostas, feedback e cotas compartilhadas no banco.

A autorização é conferida no backend. O token administrativo mantém suas funções de gestão do acervo, sem substituir a identidade do usuário. Histórico anônimo anterior não é atribuído automaticamente.

## Evidências

O PDF existente possui 197 páginas e 517 trechos na conferência. O expediente informa atualização até junho de 2008. A interface agora apresenta essa limitação quando o documento correspondente está processado.

Uma avaliação real do deployment e9077366 executou dez casos, com nove aprovados e um reprovado. O relatório preserva perguntas, respostas, páginas e parâmetros. Essa medição antecede a nova memória e não comprova que a versão posterior tenha o mesmo resultado.

Os testes automatizados verificam contratos e isolamento, com documentos e identidades de teste. A migração foi conferida em branch Neon separada. Não foram baixados documentos originais nem adicionados exemplos fictícios ao acervo de produção.

## Limites

A amostra real é pequena. O caso sobre validade da permissão falhou por evidência insuficiente. A aplicação não garante atualização da legislação nem validade de toda afirmação do LLM. E-mail, cookies e dispositivos nativos exigem homologação com a configuração final do responsável.

Detalhes em [Matriz](MATRIZ_TESTES.md), [Fontes](FONTES.md), [Contas](CONTAS_E_CONVERSAS.md) e [Limitações](LIMITACOES.md).
