"""Provedores de embeddings.

* `fastembed` (padrão): modelo semântico multilíngue executado localmente via ONNX,
  sem chave de API. O modelo é baixado do Hugging Face na primeira execução e
  armazenado em cache (EMBEDDING_CACHE_DIR).
* `hashing`: vetorização lexical determinística (n-gramas com hashing). NÃO é um
  modelo semântico; existe para testes automatizados e demonstração offline, e é
  identificado como tal em toda a interface.

Documentos e perguntas usam sempre o mesmo provedor e modelo. A "impressão digital"
(fingerprint) do provedor é gravada junto do índice para impedir a reutilização
silenciosa de um índice gerado por outro modelo.
"""

from __future__ import annotations

import hashlib
import logging
import re
import unicodedata
from abc import ABC, abstractmethod
from collections import Counter
from pathlib import Path

import numpy as np

logger = logging.getLogger("acervo.embeddings")


class EmbeddingUnavailableError(Exception):
    pass


class EmbeddingProvider(ABC):
    name: str
    model: str
    dim: int
    version: str = "1"
    semantic: bool = True

    @property
    def fingerprint(self) -> str:
        return f"{self.name}:{self.model}:{self.dim}:v{self.version}"

    @abstractmethod
    def embed_documents(self, texts: list[str]) -> np.ndarray: ...

    @abstractmethod
    def embed_query(self, text: str) -> np.ndarray: ...


def _l2_normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return (matrix / norms).astype(np.float32)


# ---------------------------------------------------------------------------
# Provedor lexical determinístico
# ---------------------------------------------------------------------------
STOPWORDS_PT = set(
    """a à às ao aos as o os um uma uns umas de da das do dos dum duma em na nas no nos num numa
    por pela pelas pelo pelos para pra com sem sob sobre entre até após ante contra desde perante
    e ou mas nem que se como quando onde qual quais quanto quanta quantos quantas porque porquê
    é são ser foi foram será serão está estão estar era eram tem têm ter há havia sua seu suas seus
    meu minha meus minhas teu tua nosso nossa este esta estes estas esse essa esses essas isto isso
    aquele aquela aquilo lhe lhes ele ela eles elas eu tu nós vós você vocês me te nos vos
    mais menos muito muita muitos muitas também já não sim só mesmo cada outro outra outros outras
    qualquer quaisquer todo toda todos todas deve devem pode podem the of and to in is are""".split()
)
_TOKEN = re.compile(r"[a-z0-9]+")
_SUFFIXES = (
    "amentos", "imentos", "amento", "imento", "mente", "ações", "ação", "idades", "idade",
    "ências", "ência", "ância", "istas", "ista", "ismos", "ismo", "ados", "adas", "idos", "idas",
    "ado", "ada", "ido", "ida", "ores", "ora", "or", "ais", "eis", "ões", "ão", "ar", "er", "ir",
    "as", "es", "os", "is", "a", "e", "o", "s",
)
_SUFFIXES_ASCII = tuple(
    sorted({unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode() for s in _SUFFIXES}, key=len, reverse=True)
)


def normalize_token_text(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    return text.encode("ascii", "ignore").decode()


_STOPWORDS_ASCII = {normalize_token_text(w) for w in STOPWORDS_PT}


def light_stem(token: str) -> str:
    if len(token) <= 4 or token.isdigit():
        return token
    for suffix in _SUFFIXES_ASCII:
        if token.endswith(suffix) and len(token) - len(suffix) >= 4:
            return token[: -len(suffix)]
    return token


def content_terms(text: str) -> list[str]:
    """Termos de conteúdo (sem stopwords, com radicalização leve). Usado também na cobertura."""
    tokens = _TOKEN.findall(normalize_token_text(text))
    return [light_stem(t) for t in tokens if t not in _STOPWORDS_ASCII and (len(t) > 1 or t.isdigit())]


class HashingEmbeddingProvider(EmbeddingProvider):
    name = "hashing"
    semantic = False
    version = "1"

    def __init__(self, dim: int = 2048):
        self.dim = dim
        self.model = "lexical-hashing-ngrams"

    def _bucket(self, feature: str) -> tuple[int, float]:
        digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
        value = int.from_bytes(digest, "little")
        return value % self.dim, (1.0 if (value >> 63) & 1 else -1.0)

    def _vector(self, text: str) -> np.ndarray:
        terms = content_terms(text)
        features: Counter[str] = Counter()
        for term in terms:
            features[f"w:{term}"] += 1.0
            if len(term) >= 5:
                for i in range(len(term) - 3):
                    features[f"c:{term[i:i + 4]}"] += 0.25
        for a, b in zip(terms, terms[1:], strict=False):
            features[f"b:{a}_{b}"] += 0.5
        vec = np.zeros(self.dim, dtype=np.float32)
        for feature, weight in features.items():
            index, sign = self._bucket(feature)
            vec[index] += sign * (1.0 + np.log(weight)) if weight >= 1 else sign * weight
        return vec

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        return _l2_normalize(np.vstack([self._vector(t) for t in texts]))

    def embed_query(self, text: str) -> np.ndarray:
        return self.embed_documents([text])[0]


# ---------------------------------------------------------------------------
# Provedor semântico local (ONNX via fastembed)
# ---------------------------------------------------------------------------
class FastEmbedProvider(EmbeddingProvider):
    name = "fastembed"
    semantic = True
    version = "1"

    def __init__(self, model: str, cache_dir: Path | None = None):
        try:
            from fastembed import TextEmbedding
        except ImportError as exc:  # pragma: no cover - depende da instalação
            raise EmbeddingUnavailableError(
                "Pacote 'fastembed' não instalado. Instale backend/requirements.txt "
                "ou use EMBEDDING_PROVIDER=hashing para testes offline."
            ) from exc
        self.model = model
        try:
            self._engine = TextEmbedding(model_name=model, cache_dir=str(cache_dir) if cache_dir else None)
        except Exception as exc:  # pragma: no cover - depende de rede/cache
            raise EmbeddingUnavailableError(
                f"Não foi possível carregar o modelo de embeddings '{model}'. Verifique o acesso à "
                "internet na primeira execução (download do Hugging Face) ou o cache local."
            ) from exc
        probe = next(iter(self._engine.embed(["teste"])))
        self.dim = int(len(probe))
        self._e5 = "e5" in model.lower()

    def embed_documents(self, texts: list[str]) -> np.ndarray:  # pragma: no cover
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        if self._e5:
            vectors = list(self._engine.passage_embed(texts))
        else:
            vectors = list(self._engine.embed(texts))
        return _l2_normalize(np.vstack(vectors))

    def embed_query(self, text: str) -> np.ndarray:  # pragma: no cover
        if self._e5:
            vector = next(iter(self._engine.query_embed(text)))
        else:
            vector = next(iter(self._engine.embed([text])))
        return _l2_normalize(np.asarray([vector]))[0]


def build_embedding_provider(name: str, model: str, *, cache_dir: Path | None = None, hashing_dim: int = 2048) -> EmbeddingProvider:
    if name == "hashing":
        return HashingEmbeddingProvider(dim=hashing_dim)
    if name == "fastembed":
        return FastEmbedProvider(model=model, cache_dir=cache_dir)
    raise EmbeddingUnavailableError(f"Provedor de embeddings desconhecido: {name}")
