# Rollback

A entrega de contas altera o controle de acesso das conversas. Reverter a aplicação para uma versão anônima antiga pode reabrir o acesso por identificador. Evite promover automaticamente um deployment anterior às contas em caso de incidente.

Prefira corrigir o deployment atual ou bloquear temporariamente /api/chat, /api/conversations e /api/account durante diagnóstico. Preserve o banco. Não remova as tabelas de propriedade para tentar recuperar a UI antiga.

As migrações novas são aditivas e os dados anteriores não são apagados. Histórico sem proprietário fica sem acesso até vínculo administrativo. A exclusão de uma conversa remove mensagens e feedbacks; a marca do ID permanece para impedir reutilização.

Após qualquer correção, valide login, 401 anônimo, isolamento entre duas contas, exportação, exclusão, cotas e resposta com fontes. Faça backup pelo mecanismo de recuperação do Neon antes de intervenções destrutivas.
