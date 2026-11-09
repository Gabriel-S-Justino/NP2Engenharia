# Histórico de chats do Lumme

## Uso

Use a sidebar para consultar as conversas salvas neste navegador ou dispositivo. No celular, abra o botão Abrir menu de conversas no topo da tela. A primeira pergunta dá nome ao chat; a lista é ordenada pela resposta mais recente e permite busca pelo título.

Nova conversa fica no topo da sidebar e abre um chat vazio sem apagar os anteriores. Abra um item do histórico para rever perguntas, respostas, avisos e citações e continuar enviando perguntas no mesmo chat. A conversa ativa fica destacada na lista e continua selecionada ao recarregar o aplicativo.

A sidebar segue a organização de aplicações de chat: ação Nova conversa no topo, atalhos da aplicação, busca Buscar chats, lista Seus chats com rolagem própria e configurações no rodapé. Ferramentas da equipe expande os links de revisão e diário. O painel pode ser recolhido para uma barra de ícones; Buscar chats o expande novamente. No celular, o menu aparece pela esquerda e fecha ao selecionar uma conversa. O histórico não ocupa mais um modal separado nem a barra de ações da tela de chat.

Para apagar um chat, abra-o e use Limpar conversa, confirmando a remoção. Se a operação falhar no servidor, a interface mantém a conversa e avisa que ela ainda está salva. Nenhuma conversa real deve ser apagada durante testes de produção.

## Armazenamento e privacidade

O catálogo local guarda somente identificador, título e data da última resposta, na chave versionada conversations-v1 do armazenamento existente. As mensagens completas, fontes e metadados continuam no banco do servidor, sob a política de retenção já configurada.

Não há login ou sincronização entre dispositivos. A lista pertence a este navegador, origem e perfil. Pessoas que compartilham o mesmo perfil do navegador podem ver seus títulos e acessar os chats salvos. Limpar dados do navegador remove o catálogo e os identificadores necessários para reabrir as conversas; não equivale a excluir as mensagens no servidor.

Não foi criado um endpoint público para listar chats de todos os usuários. A leitura continua exigindo o identificador da conversa, como no contrato existente. Admin token não é necessário para conversar ou consultar o próprio histórico.

A conversa antiga identificada por conversation-id é incorporada ao catálogo quando restaurada. A aplicação não consegue descobrir conversas cujos identificadores já tenham sido perdidos. Perguntas que falharam antes de receber uma resposta do servidor continuam com a opção de repetir na conversa atual, mas não são salvas no histórico após recarregar.

## API

GET /api/chat/history/{conversation_id} preserva conversation_id e items e acrescenta has_more.

- limit: de 1 a 100, padrão 100.
- offset: inteiro a partir de zero, padrão zero.
- Ordenação estável por created_at e id.
- Cada página consulta apenas a conversa solicitada.
- O frontend carrega as páginas até has_more ser falso e só então troca a conversa visível.
- Uma falha durante o carregamento mantém o chat anteriormente aberto.

DELETE /api/chat/history/{conversation_id} continua apagando apenas a conversa informada. Não houve migração de banco nem mudança na recuperação de documentos, geração do LLM ou validação de citações. Retomar um chat restaura a exibição das mensagens; não acrescenta memória contextual às chamadas do LLM.

## Concorrência e falhas

Enquanto houver envio ou carregamento, nova conversa e seleção ficam bloqueadas. As mesmas verificações existem no estado, além dos botões, para impedir operações simultâneas. As gravações do catálogo e do identificador ativo são serializadas. Falha de armazenamento mantém o comportamento anterior: o aplicativo funciona na sessão, mas a persistência depende de o navegador permitir armazenamento.

Falhas de leitura apresentam nova tentativa e não são tratadas como histórico vazio. Quando a retenção já removeu as mensagens, o chat exibe a ausência de conteúdo. Não são copiadas respostas para armazenamento local.

## Validação

Testes adicionados para catálogo inválido, títulos, ordenação, migração da conversa anterior, persistência após remontar, criação e retomada, fontes preservadas, bloqueio durante envio, falhas de abertura e remoção, recuperação após indisponibilidade e paginação com isolamento de conversas.

As verificações de CI executam TypeScript, lint, testes frontend e backend e build web. A verificação visual de produção usa chats vazios e leitura de dados existentes, sem uploads ou exclusão de conversas reais.
