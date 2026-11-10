# Contas e conversas do Lumme

Atualizado em 10/11/2026.

## Acesso

A tela Sua conta permite criar conta com e-mail e senha, entrar, recuperar acesso com código e sair. O serviço é Neon Auth gerenciado. O frontend usa o SDK oficial `@neon/auth`; senhas não passam pela API Python. Ao criar ou redefinir, a interface exige pelo menos 12 caracteres. O servidor de identidade mantém sua própria política.

A API recebe o JWT de curta duração pelo cabeçalho Authorization e confere assinatura EdDSA, expiração, emissor e público no JWKS do Neon Auth. Emissor e público são a origem HTTPS do serviço, sem o caminho /neondb/auth. ID de conversa e token administrativo não substituem login.

## Histórico

O catálogo da sidebar vem do servidor e é filtrado pelo usuário autenticado. A seleção da conversa fica no dispositivo, separada por usuário. Ao entrar na mesma conta em outro navegador, o catálogo é recuperado do banco. Ao trocar de conta, mensagens e token administrativo visíveis são limpos; respostas atrasadas são descartadas.

Conversas antigas sem proprietário continuam no banco, sem acesso público. Quem tem o catálogo antigo neste navegador pode vinculá-lo em Sua conta, após confirmação e apresentação do token administrativo. Esse privilégio permite atribuir conversas não vinculadas; não deve ser compartilhado com usuários comuns. Conversas já vinculadas não mudam de dono.

## Contexto

Até seis respostas anteriores bem-sucedidas e 6.000 caracteres ajudam a resolver referências como “e por quê?”. O histórico é delimitado, escapado e identificado como conteúdo não verificado. Rótulos antigos de citações são removidos. Evidências e citações da resposta atual continuam vindo da recuperação atual. Não há memória entre contas ou entre conversas.

## Ações

O menu de cada conversa permite renomear, exportar em Markdown e excluir após confirmação. Excluir remove mensagens e feedbacks, mantendo um identificador marcado como excluído para impedir reutilização indevida. Cada resposta oferece copiar, Útil e Não ajudou. O feedback pertence ao dono da conversa e fica no banco.

A exportação contém perguntas, respostas e fontes. O usuário escolhe onde guardar o arquivo. Na web o download usa Blob; no aplicativo nativo usa os módulos Expo FileSystem e Sharing. O build web foi validado; homologação em dispositivos nativos permanece uma etapa separada.

## Cotas

Os contadores ficam em usage_buckets no banco e são compartilhados entre instâncias. A admissão é transacional: se qualquer limite falhar, os outros incrementos são revertidos. Contam-se requisições admitidas, inclusive as que terminam em recusa ou falha do provedor. Usuário por minuto, IP por minuto, usuário por dia e serviço por dia têm limites separados. Janela diária renova às 00:00 UTC. Sua conta mostra consumo próprio, limites e renovação.
