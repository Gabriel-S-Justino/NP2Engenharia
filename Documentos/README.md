# Documentos/ — acervo real da equipe

Coloque aqui os documentos **reais** reunidos pela equipe sobre leis de trânsito (PDF, TXT ou MD).
Subpastas são permitidas (ex.: `legislacao/`, `resolucoes/`, `cartilhas/`).

> O sistema **nunca** altera, renomeia ou apaga arquivos desta pasta. A remoção pela interface
> apenas retira o documento do índice; o arquivo original continua aqui.

## Requisito do professor

- Mínimo de **10 documentos** ou material equivalente a **25 páginas de conteúdo útil** para as consultas.
- Cada documento deve ser **selecionado e validado pela equipe** (leitura humana, não apenas download).
- Registrar metadados (título, autoria/instituição, URL, data, versão, licença, assunto) em `manifest.json`.
- Registrar lacunas e fontes frágeis/desatualizadas em `docs/FONTES.md`.

Este repositório **ainda não contém documentos reais**. O requisito só estará cumprido depois que a
equipe adicionar e validar os arquivos.

## Passo a passo

1. Copie os arquivos para esta pasta. Prefira PDFs digitais (com texto selecionável).
   PDFs digitalizados (imagem) exigem OCR (`OCR_ENABLED=true` + Tesseract instalado).
2. Preencha `manifest.json` (veja `manifest.example.json`). A chave é o caminho relativo do arquivo.
3. Gere o inventário e confira o requisito mínimo:
   ```bash
   python scripts/inventario_documentos.py
   ```
4. Indexe pela interface (Documentos → "Indexar pasta") ou pelo terminal:
   ```bash
   python scripts/ingest_documents.py
   ```
5. Revise o relatório de ingestão: documentos com falha mostram o motivo (ex.: PDF sem texto).
6. Atualize `docs/FONTES.md` com a tabela de fontes e as observações de confiabilidade.

## Sugestões de fontes (a equipe deve verificar disponibilidade, versão e licença)

- Código de Trânsito Brasileiro — Lei nº 9.503/1997, texto compilado (Planalto).
- Resoluções do CONTRAN pertinentes ao público iniciante (habilitação, cadeirinha, equipamentos).
- Manual Brasileiro de Fiscalização de Trânsito (SENATRAN).
- Cartilhas educativas de DETRANs estaduais (verificar licença de uso).
- Manuais de direção defensiva oficiais.

## Checklist de validação por documento

- [ ] Fonte oficial ou reconhecida (órgão público, instituição de ensino)?
- [ ] Data/versão registrada? Está atualizado em relação à legislação vigente?
- [ ] Licença permite uso acadêmico? (Textos de leis são de domínio público — Lei 9.610/1998, art. 8º, IV.)
- [ ] Texto extraível (não é imagem)? Verificado no inventário.
- [ ] Conteúdo útil para as perguntas do público-alvo (motoristas iniciantes)?
- [ ] Metadados preenchidos em `manifest.json`?
- [ ] Integrante responsável pela validação registrado em `docs/FONTES.md`?

## Privacidade

Não coloque documentos com dados pessoais ou confidenciais. Por padrão, o `.gitignore` impede que
os arquivos desta pasta sejam enviados ao GitHub; versione apenas documentos públicos, se a equipe decidir.
