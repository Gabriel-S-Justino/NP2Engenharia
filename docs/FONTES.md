# Fontes do acervo

> **Estado:** nenhum documento real foi adicionado até esta versão. A tabela abaixo deve ser preenchida pela
> equipe **depois** de ler e validar cada documento. Não preencha campos que a fonte não informa: use "não informado".

Requisito do professor: **mínimo de 10 documentos ou 25 páginas de conteúdo útil**. Gere o inventário automático
com `python scripts/inventario_documentos.py --markdown docs/resultados/inventario_documentos.md` e confira
abaixo a utilidade de cada fonte (decisão humana).

## Tabela de fontes (a preencher)

| ID | Título | Autor ou instituição | URL ou caminho | Data | Versão | Licença | Relevância para o público | Observações sobre confiabilidade | Validado por |
|---|---|---|---|---|---|---|---|---|---|
| F-01 | | | `Documentos/...` | | | | | | |
| F-02 | | | | | | | | | |
| F-03 | | | | | | | | | |
| F-04 | | | | | | | | | |
| F-05 | | | | | | | | | |
| F-06 | | | | | | | | | |
| F-07 | | | | | | | | | |
| F-08 | | | | | | | | | |
| F-09 | | | | | | | | | |
| F-10 | | | | | | | | | |

## Lacunas e fontes frágeis (a preencher)

| Tema necessário ao público | Coberto? | Lacuna / risco | Ação |
|---|---|---|---|
| Habilitação e permissão para dirigir | | | |
| Limites de velocidade | | | |
| Infrações, pontuação e suspensão | | | |
| Álcool e direção | | | |
| Transporte de crianças | | | |
| Pedestres e ciclistas | | | |

Critérios para marcar uma fonte como frágil: não oficial, sem data/versão, desatualizada em relação a alterações
recentes do CTB, licença incerta, PDF digitalizado com extração ruim, conteúdo contraditório com fonte oficial.

## Sugestões de busca (verificar antes de usar)

- Lei nº 9.503/1997 (Código de Trânsito Brasileiro), texto compilado — Planalto.
- Resoluções do CONTRAN aplicáveis a condutores iniciantes.
- Manual Brasileiro de Fiscalização de Trânsito — SENATRAN.
- Manuais de direção defensiva e cartilhas de DETRANs (conferir licença).

Textos de leis, decretos e regulamentos não são protegidos por direito autoral no Brasil (Lei 9.610/1998,
art. 8º, IV); cartilhas e manuais de terceiros podem ter restrições.

## Fontes sintéticas de teste (não são fontes do trabalho)

| Arquivo | Natureza | Uso |
|---|---|---|
| `tests/fixtures/documentos_sinteticos/regulamento_sintetico_vila_exemplo.pdf` | Fictício (3 páginas) | Suíte automatizada `fixtures` |
| `tests/fixtures/documentos_sinteticos/guia_sintetico_pedestres_ciclistas.txt` | Fictício (3 páginas) | Suíte automatizada `fixtures` |
| `tests/fixtures/documentos_sinteticos/boletim_sintetico_mobilidade_com_injecao.txt` | Fictício, contém injeção proposital | Teste de segurança |
