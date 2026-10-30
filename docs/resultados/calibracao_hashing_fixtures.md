# Calibração do limiar — hashing:lexical-hashing-ngrams:2048:v1

- Data: 2026-10-30T00:41:11+00:00
- Conjunto: `calibracao_fixtures.json` (18 perguntas; acervo sintético de teste)
- Embeddings semânticos: NÃO (hashing lexical)
- Classes separáveis: sim
- Menor similaridade entre respondíveis: 0.1764
- Maior similaridade entre não respondíveis: 0.1049
- **Limiar sugerido: 0.141** (acurácia de separação no conjunto: 100%)

| Pergunta | Respondível? | Maior similaridade |
|---|---|---|
| Em qual banco as crianças devem ser transportadas? | sim | 0.6090 |
| Quanto tempo dura o sinal verde para pedestres nas travessias centrais? | sim | 0.5614 |
| Qual é a velocidade máxima nas avenidas arteriais do município? | sim | 0.4681 |
| Qual final de placa não circula às quartas-feiras no rodízio? | sim | 0.4406 |
| Qual crachá o aprendiz deve usar durante as aulas práticas? | sim | 0.3003 |
| Quando os pontos do cadastro expiram? | sim | 0.2937 |
| Por quanto tempo vale a Permissão de Aprendiz? | sim | 0.2821 |
| Os radares educativos geram autuação? | sim | 0.2490 |
| Em que dias e horários funcionam as ciclofaixas azuis? | sim | 0.2347 |
| Qual a carga horária do curso de reciclagem? | sim | 0.1764 |
| Como funciona a fotossíntese nas plantas? | não | 0.1049 |
| Que idade é exigida para dirigir caminhões? | não | 0.0726 |
| Qual é a capital da França? | não | 0.0506 |
| Quem ganhou a Copa do Mundo de futebol de 2002? | não | 0.0319 |
| Qual a multa por estacionar em vaga reservada para idosos? | não | 0.0313 |
| Qual o horário de atendimento do Detran? | não | 0.0195 |
| Qual a taxa de juros de um financiamento de carro? | não | 0.0098 |
| Como fazer pão caseiro sem fermento? | não | 0.0046 |

## Comportamento final com limiar 0.141

| Pergunta | Esperado | Status obtido | Correto? |
|---|---|---|---|
| Por quanto tempo vale a Permissão de Aprendiz? | responder | answered | sim |
| Qual crachá o aprendiz deve usar durante as aulas práticas? | responder | answered | sim |
| Qual é a velocidade máxima nas avenidas arteriais do município? | responder | answered | sim |
| Os radares educativos geram autuação? | responder | answered | sim |
| Quando os pontos do cadastro expiram? | responder | answered | sim |
| Qual a carga horária do curso de reciclagem? | responder | answered | sim |
| Quanto tempo dura o sinal verde para pedestres nas travessias centrais? | responder | answered | sim |
| Em que dias e horários funcionam as ciclofaixas azuis? | responder | insufficient_evidence | NÃO |
| Em qual banco as crianças devem ser transportadas? | responder | answered | sim |
| Qual final de placa não circula às quartas-feiras no rodízio? | responder | answered | sim |
| Qual é a capital da França? | recusar | out_of_scope | sim |
| Como fazer pão caseiro sem fermento? | recusar | out_of_scope | sim |
| Quem ganhou a Copa do Mundo de futebol de 2002? | recusar | out_of_scope | sim |
| Como funciona a fotossíntese nas plantas? | recusar | out_of_scope | sim |
| Qual a taxa de juros de um financiamento de carro? | recusar | out_of_scope | sim |
| Qual o horário de atendimento do Detran? | recusar | out_of_scope | sim |
| Qual a multa por estacionar em vaga reservada para idosos? | recusar | out_of_scope | sim |
| Que idade é exigida para dirigir caminhões? | recusar | insufficient_evidence | sim |

Acurácia de ponta a ponta no conjunto de calibração: 17/18 (94%).

Observação: o limiar é apenas a primeira barreira; perguntas no domínio com informação ausente são tratadas também pela cobertura de termos (MIN_TERM_COVERAGE) e pelo LLM (SEM_EVIDENCIA).
