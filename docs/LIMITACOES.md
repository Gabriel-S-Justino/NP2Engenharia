# Limitações atuais

- O CTB atualmente conferido foi atualizado até junho de 2008. Respostas descrevem esse arquivo e não asseguram a legislação vigente. Nenhum documento mais recente foi baixado automaticamente.
- A avaliação real de 10/11/2026 obteve 9 de 10 casos no commit e9077366, anterior à mudança de contas. O caso de validade da permissão falhou. A amostra é pequena e não comprova cobertura de todo o documento nem estabilidade do Gemini.
- Memória contextual inclui no máximo o orçamento configurado de turnos respondidos. Conversas longas podem perder referências antigas. Não existe resumo persistente produzido por LLM.
- As citações são rastreáveis e validadas por rótulo. Isso não prova que cada frase esteja correta.
- Falhas temporárias, indisponibilidade e cotas do Gemini continuam possíveis.
- Na web publicada, o cookie de sessão é do próprio domínio do Lumme. O login depende da disponibilidade do Neon Auth. A entrega de código pelo remetente compartilhado ficou pendente na validação de 11/11/2026. Veja a configuração de SMTP em [Produção](PRODUCAO.md).
- Não há sincronização em tempo real da sidebar entre abas já abertas. O catálogo é carregado ao entrar e após operações; reabrir a página atualiza dados de outro dispositivo.
- Histórico anônimo anterior não tem prova de propriedade. Somente um administrador pode vinculá-lo a uma conta.
- O feedback fica salvo no banco. A seleção visual dos botões é local à montagem da mensagem e não é restaurada ao reabrir.
- Consumo é contado em requisições admitidas, sem cálculo de custo monetário ou tokens faturados.
- O ADMIN_TOKEN é um privilégio compartilhado, independente da conta; ainda não há painel de papéis por usuário.
- Web é o alvo verificado. Login, armazenamento de sessão e compartilhamento em Android/iOS exigem homologação nativa antes de distribuição.
