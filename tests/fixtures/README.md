# tests/fixtures/ — MATERIAL SINTÉTICO DE TESTE

Os arquivos em `documentos_sinteticos/` são **fictícios** ("Município de Vila Exemplo") e foram criados pela
equipe de desenvolvimento apenas para validar o software (ingestão, recuperação, citações, recusa e segurança).

- **Não são legislação real** e não devem ser citados como fontes sobre leis de trânsito.
- Os valores (180 dias, 25 km/h, 30 pontos…) foram inventados de propósito para não se confundirem com o CTB.
- `boletim_sintetico_mobilidade_com_injecao.txt` contém, deliberadamente, uma instrução maliciosa para testar
  a resistência a *prompt injection*.
- O PDF é gerado por `scripts/generate_fixtures.py`.

A suíte `tests/acceptance/matriz_fixtures.json` usa estes documentos em um pipeline **isolado** (banco e índice
próprios em `data/eval_fixtures/`), sem misturá-los com o acervo real de `Documentos/`.
