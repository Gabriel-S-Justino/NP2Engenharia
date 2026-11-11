# Testes de produção

Após publicar:

1. Abra Sua conta, crie ou use uma conta de teste e confirme a entrada. Recarregue a página e confira se a sessão permanece. Teste uma senha errada e verifique a mensagem de credenciais.
2. Faça uma pergunta respondível sobre o arquivo e confira resposta, fontes e aviso de edição antiga.
3. Faça uma continuação na mesma conversa e confira que as fontes continuam atuais à requisição.
4. Renomeie e reabra o chat pela sidebar. Exporte e confira perguntas, respostas e fontes. Teste copiar e avaliar.
5. Entre na mesma conta em outro navegador e confira o catálogo. Uma conta diferente não pode acessar os mesmos IDs.
6. Teste sessão expirada e acesso anônimo: as rotas privadas devem retornar 401.
7. Confira consumo em Sua conta e o horário de renovação. Limites devem retornar 429.
8. Exclua somente uma conversa criada para seu próprio teste, após confirmar, e confira que ela não reaparece.
9. Saia da conta, solicite recuperação para o e-mail cadastrado e verifique o recebimento. Digite o código mais recente, altere a senha e entre com a nova senha. Registre separadamente o aceite da solicitação e o recebimento do código.

Testes que removem dados devem usar conversas próprias de validação e consentimento do responsável. Não reindexe nem troque o acervo para validar apenas a interface.

A entrega de e-mail e os navegadores alvo precisam de homologação humana. A matriz real produz chamadas ao provedor, consumo e relatório; executar testes sintéticos não substitui essa avaliação.

Os resultados desta entrega e as condições verificadas estão em [Relatório](RELATORIO.md) e [Matriz](MATRIZ_TESTES.md).
