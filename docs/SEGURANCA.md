# Segurança

Atualizado em 10/11/2026.

## Identidade e autorização

Neon Auth gerencia credenciais e sessões. JWTs são verificados no backend usando JWKS, algoritmo EdDSA, expiração, emissor e público. Ausência ou invalidade retorna 401; indisponibilidade de validação retorna 503. As rotas privadas usam Cache-Control private, no-store e Vary Authorization.

Todas as operações de conversa exigem identidade e propriedade: listar, consultar mensagens, renomear, exportar, excluir, enviar pergunta no mesmo ID e avaliar resposta. Outro usuário recebe 404 sem confirmação de existência. IDs excluídos não podem ser reutilizados.

O ADMIN_TOKEN continua protegendo alteração do acervo, avaliações e outras ações administrativas. Ele não autentica uma conta. O vínculo de histórico anônimo exige ambos os controles. Nunca publique tokens ou chaves no GitHub, frontend ou EXPO_PUBLIC_*.

O token administrativo salvo no navegador fica separado por conta. Um administrador deve sair da conta ao usar um dispositivo compartilhado. Não existe política de papéis do administrador por usuário nesta versão; o token é um privilégio compartilhado.

## Consumo

Cotas por usuário, IP e serviço são transacionais e persistidas no banco. O limite diário utiliza UTC. A aplicação não estima custo financeiro por tokens; os contadores indicam solicitações admitidas. Os logs não devem registrar JWTs, senhas nem chaves.

## Conteúdo

Uploads mantêm validação de extensão, conteúdo, tamanho e caminhos. Trechos recuperados e histórico são dados não confiáveis. Histórico é escapado e não fornece citações factuais. A validação de rótulos não comprova todas as afirmações de uma resposta.

## Operação

Configure origens exatas no CORS da API e na lista de origens confiáveis do Neon Auth. Use domínio de autenticação e SMTP próprios para operação consolidada; valide entrega de recuperação de senha e política de verificação de e-mail. O projeto existente usa o remetente compartilhado do provedor. Não há promessa de entrega de e-mail ou homologação de todos os navegadores.

Veja [Variáveis de ambiente](VARIAVEIS_AMBIENTE.md), [Contas](CONTAS_E_CONVERSAS.md) e [Rollback](ROLLBACK.md).
