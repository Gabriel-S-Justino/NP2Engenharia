# Diário de validação com a IA mentora

O guia da disciplina exige registrar, para cada validação: **prompt enviado, resposta da IA, decisão da equipe,
alteração realizada e evidência do resultado**. A IA mentora deve avaliar problema, base documental, arquitetura,
respostas, riscos, segurança e privacidade — e a equipe deve **conferir as sugestões contra as fontes originais**.

> **Estado:** nenhuma interação com a IA mentora foi registrada ainda. Este documento traz a estrutura e prompts
> prontos. **Não registre interações que não aconteceram.** O agente de desenvolvimento que implementou o software
> não é a IA mentora e não preencheu entradas em nome da equipe.

Registros também podem ser feitos na tela **Diário da IA mentora** do aplicativo (`POST /api/mentor-log`), que os
persiste no banco; copie-os para cá antes da entrega.

## Modelo de registro

```markdown
### Registro N — AAAA-MM-DD — <etapa>
1. Data:
2. Etapa do projeto:
3. Prompt enviado à IA mentora: (texto completo)
4. Resposta recebida: (texto completo ou trecho relevante + link/captura)
5. Evidências consultadas pela equipe: (documento, página, teste, log)
6. Decisão tomada: (aceitar / rejeitar / adaptar — e por quê)
7. Alteração realizada: (arquivo/commit)
8. Teste executado: (comando ou caso da matriz)
9. Resultado anterior:
10. Resultado posterior:
Responsável:
```

## Registros

_(nenhum registro real até o momento)_

## Prompts sugeridos

Antes de enviar, anexe o contexto real (README, ARQUITETURA, trechos dos documentos, resultados da matriz).

1. **Adequação do problema ao RAG** — "Nosso público são motoristas iniciantes e o problema é a dificuldade de
   entender as leis de trânsito. Avalie criticamente se RAG é adequado, quando uma busca por palavra-chave bastaria e
   quais riscos existem em responder sobre legislação."
2. **Qualidade e autoridade das fontes** — "Esta é a lista de fontes (anexa, com data, versão e licença). Avalie
   autoridade, atualidade, licença e lacunas para o público iniciante. Quais fontes são frágeis?"
3. **Tamanho dos chunks e sobreposição** — "Usamos chunks de 800 caracteres com 120 de sobreposição, por página,
   quebrando em títulos de artigo. Com base nestes exemplos de chunks (anexos), o tamanho preserva o sentido dos
   artigos? Proponha um experimento para comparar 500/800/1200."
4. **Escolha dos embeddings** — "Usamos paraphrase-multilingual-MiniLM-L12-v2 local. Compare com multilingual-e5
   para textos jurídicos em português, considerando custo, privacidade e qualidade."
5. **Recuperação dos trechos** — "Para estas perguntas, estes foram os trechos recuperados e suas similaridades
   (anexo). Os trechos corretos estão no top-5? O que explica os erros?"
6. **Limiar de similaridade** — "Esta é a distribuição de similaridades de perguntas respondíveis e não
   respondíveis (relatório de calibração). O limiar sugerido é adequado? Que riscos há em ajustá-lo com poucos exemplos?"
7. **Fidelidade das respostas** — "Compare cada resposta com o trecho citado (anexo). Há afirmações não sustentadas?"
8. **Validade das citações** — "Estas citações apontam para a página e o trecho corretos? Encontre exemplos de
   citação correta para uma afirmação incorreta."
9. **Alucinações** — "Proponha 5 perguntas sobre trânsito cuja resposta não está no acervo e que um modelo tenderia a
   responder de memória. Use-as para testar a recusa."
10. **Privacidade e segurança** — "Avalie riscos de enviar trechos a um LLM externo, retenção de histórico e
    exposição da API. O que falta para publicação?"
11. **Injeção de prompts** — "Tente 5 formas de injeção (na pergunta e dentro de um documento) contra estas regras
    (anexas). Quais poderiam passar pela detecção por padrões?"
12. **Limitações do sistema** — "Leia nossas limitações (anexo). O que está faltando ou subestimado?"

## Como conferir as sugestões

- Toda afirmação factual da IA mentora sobre trânsito deve ser conferida no documento oficial (registrar página).
- Toda sugestão técnica aceita deve virar alteração + teste + resultado antes/depois neste diário.
- Sugestões rejeitadas também são registradas, com o motivo.
