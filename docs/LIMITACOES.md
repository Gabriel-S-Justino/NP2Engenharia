# Limitações conhecidas

## Formatos e extração
- Suporte a PDF, TXT e MD. DOCX/HTML exigem um novo leitor (registrar em `LOADERS` em `document_loader.py`).
- PDFs digitalizados (imagem) não têm texto extraível; o OCR é **opcional** (`OCR_ENABLED=true`, requer
  `pytesseract`, `Pillow` e Tesseract) e **não foi testado** neste ambiente. Páginas sem texto geram aviso.
- A extração do `pypdf` pode quebrar palavras, juntar colunas ou perder tabelas; a limpeza é conservadora.
- A detecção de seções é heurística (Art., CAPÍTULO, SEÇÃO, linhas em maiúsculas).
- TXT só tem página quando o arquivo usa quebra de página (`\f`); sem isso, a citação mostra "Página não informada".

## Busca semântica
- O modelo `fastembed` padrão **não foi executado neste ambiente de desenvolvimento** (acesso ao Hugging Face
  bloqueado); testes e avaliação usaram o provedor lexical `hashing`, que **não é semântico**.
- O limiar 0,35 do `fastembed` é inicial e **não calibrado**. Limiar alto demais recusa perguntas legítimas; baixo
  demais aceita trechos irrelevantes.
- No modo extrativo, a cobertura lexical pode recusar paráfrases (1 recusa indevida em 18 no conjunto de calibração).
- Busca exata (`IndexFlatIP`) é adequada para milhares de trechos; acervos muito maiores pediriam índice aproximado.

## Respostas e citações
- Respostas podem estar incorretas mesmo com citação: a citação mostra de onde veio a informação, não prova a
  correção. O usuário deve ler o trecho.
- A validação garante que os rótulos citados existem entre os trechos recuperados, mas não que cada frase do LLM
  seja fiel ao trecho (fidelidade automática é aproximada por palavras-chave na avaliação).
- A detecção de divergência entre fontes é heurística (números com a mesma unidade).
- O modo demonstração **não é um LLM**: apenas copia frases; não sintetiza nem explica.
- O LLM real **não foi executado** (sem credencial); o adaptador foi testado com cliente simulado.

## Avaliação
- A matriz executada tem 10 casos sobre 3 documentos fictícios — valida o software, não a qualidade com o acervo real.
- A matriz do acervo real depende de a equipe preencher respostas esperadas a partir das fontes.

## Provedores externos, custos e privacidade
- Com `LLM_PROVIDER=anthropic`, cada pergunta envia a pergunta e até top-k trechos à API, com custo por token
  (preço vigente na página oficial da Anthropic) e sujeito à política de dados do provedor.
- Hospedagem do backend com disco persistente costuma exigir plano pago (verificar preços atuais).
- O download do modelo de embeddings (~120 MB) exige internet na primeira execução.

## Implantação na Vercel
- Upload pela interface limitado a 4 MB (limite de 4,5 MB do corpo da requisição); arquivos maiores pela CLI.
- A primeira pergunta/indexação após ociosidade baixa e carrega o modelo de embeddings (~120 MB) em `/tmp`: pode
  levar dezenas de segundos ("cold start"). Não medido neste ambiente.
- Cada chamada de indexação tem orçamento de ~240 s; acervos grandes são processados em vários lotes (automático na
  interface e pelo cron diário). Um único PDF que demore mais que o limite da função (300 s) não pode ser indexado
  pela Vercel — use a CLI.
- OCR não está disponível na função (sem Tesseract): PDFs digitalizados devem ser tratados localmente.
- Limite de requisições e estado da avaliação "em andamento" são por instância (memória).
- Plano gratuito do Neon informa 0,5 GB de armazenamento (originais + trechos + vetores); confira limites atuais.
- Limites de duração/pacote da Vercel variam por plano e mudam com o tempo: o pacote medido (~221 MB) cabe no limite
  atual informado pela documentação (500 MB) e também no antigo (250 MB).
- Nenhum deploy real foi feito: comportamento validado com `vercel build`, o handler oficial do runtime Python e
  uma simulação local, mas não na infraestrutura da Vercel.

## Operação
- Modo local/contêiner: uma única instância (SQLite + FAISS em disco). Na Vercel, várias instâncias compartilham o
  Postgres/pgvector (com trava para indexação).
- Sem autenticação de usuários finais; operações administrativas usam um token compartilhado.
- Android/iOS: compatibilidade pela arquitetura Expo; **não testado em dispositivos físicos nem emuladores**
  neste ambiente. A web foi testada em Chromium (Playwright) em larguras de celular, tablet e desktop.
- A imagem Docker não pôde ser construída neste ambiente (limite de requisições do Docker Hub); o comando de
  produção foi verificado executando o mesmo `uvicorn` fora do contêiner.
