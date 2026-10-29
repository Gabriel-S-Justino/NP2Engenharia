"""Armazenamento vetorial com persistência em disco.

Interface `VectorStore` com duas implementações intercambiáveis:

* `FaissVectorStore` (padrão): `IndexIDMap2(IndexFlatIP)`; busca exata por produto
  interno sobre vetores L2-normalizados, ou seja, **similaridade de cosseno**
  (de -1 a 1; maior = mais parecido). Persistido com `faiss.write_index`, formato
  binário nativo do FAISS (sem pickle).
* `NumpyVectorStore`: mesma métrica, persistida em `.npy` com `allow_pickle=False`.
  Útil quando o FAISS não está disponível na plataforma.

Os IDs inteiros do índice são o `vector_id` da tabela `chunks` no SQLite; todos os
metadados ficam no banco relacional. Um arquivo JSON ao lado do índice registra a
impressão digital do modelo de embeddings para detectar incompatibilidades.
"""

from __future__ import annotations

import json
import os
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

import numpy as np

METRIC = "cosine (inner product sobre vetores normalizados)"


class IndexIncompatibleError(Exception):
    pass


@dataclass
class IndexInfo:
    backend: str
    fingerprint: str | None
    dim: int | None
    count: int
    metric: str = METRIC


class VectorStore(ABC):
    backend: str

    def __init__(self, directory: Path):
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self.fingerprint: str | None = None
        self.dim: int | None = None

    @property
    def meta_path(self) -> Path:
        return self.directory / f"{self.backend}.meta.json"

    # Ciclo de vida -----------------------------------------------------------
    def configure(self, fingerprint: str, dim: int) -> None:
        """Associa o índice a um modelo. Se já houver índice de outro modelo, falha."""
        with self._lock:
            if self.fingerprint and self.fingerprint != fingerprint and self.count() > 0:
                raise IndexIncompatibleError(
                    f"O índice existente foi criado com '{self.fingerprint}', mas o modelo atual é "
                    f"'{fingerprint}'. Reindexe o acervo para continuar."
                )
            if self.fingerprint != fingerprint or self.dim != dim:
                self.fingerprint, self.dim = fingerprint, dim
                self._reset_storage(dim)

    def reset(self, fingerprint: str, dim: int) -> None:
        with self._lock:
            self.fingerprint, self.dim = fingerprint, dim
            self._reset_storage(dim)
            self.save()

    def info(self) -> IndexInfo:
        return IndexInfo(backend=self.backend, fingerprint=self.fingerprint, dim=self.dim, count=self.count())

    def _write_meta(self) -> None:
        tmp = self.meta_path.with_suffix(".tmp")
        tmp.write_text(
            json.dumps({"fingerprint": self.fingerprint, "dim": self.dim, "count": self.count(), "metric": METRIC}),
            encoding="utf-8",
        )
        os.replace(tmp, self.meta_path)

    def _read_meta(self) -> dict | None:
        if not self.meta_path.exists():
            return None
        try:
            return json.loads(self.meta_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None

    # Operações abstratas --------------------------------------------------------
    @abstractmethod
    def _reset_storage(self, dim: int) -> None: ...

    @abstractmethod
    def load(self) -> bool: ...

    @abstractmethod
    def save(self) -> None: ...

    @abstractmethod
    def add(self, ids: list[int], vectors: np.ndarray) -> None: ...

    @abstractmethod
    def remove(self, ids: list[int]) -> int: ...

    @abstractmethod
    def search(self, vector: np.ndarray, k: int) -> list[tuple[int, float]]: ...

    @abstractmethod
    def count(self) -> int: ...

    @abstractmethod
    def ids(self) -> set[int]: ...


class FaissVectorStore(VectorStore):
    backend = "faiss"

    def __init__(self, directory: Path):
        import faiss  # import tardio: permite usar NumpyVectorStore sem FAISS

        self._faiss = faiss
        self._index = None
        super().__init__(directory)

    @property
    def index_path(self) -> Path:
        return self.directory / "faiss.index"

    def _reset_storage(self, dim: int) -> None:
        self._index = self._faiss.IndexIDMap2(self._faiss.IndexFlatIP(dim))

    def load(self) -> bool:
        with self._lock:
            meta = self._read_meta()
            if not meta or not self.index_path.exists():
                return False
            index = self._faiss.read_index(str(self.index_path))
            if index.d != meta.get("dim"):
                raise IndexIncompatibleError("Dimensão do índice FAISS não confere com os metadados.")
            self._index = index
            self.fingerprint, self.dim = meta.get("fingerprint"), meta.get("dim")
            return True

    def save(self) -> None:
        with self._lock:
            if self._index is None:
                return
            tmp = self.index_path.with_suffix(".tmp")
            self._faiss.write_index(self._index, str(tmp))
            os.replace(tmp, self.index_path)
            self._write_meta()

    def add(self, ids: list[int], vectors: np.ndarray) -> None:
        if not ids:
            return
        with self._lock:
            if self._index is None:
                raise IndexIncompatibleError("Índice não configurado.")
            self._index.add_with_ids(np.ascontiguousarray(vectors, dtype=np.float32), np.asarray(ids, dtype=np.int64))

    def remove(self, ids: list[int]) -> int:
        if not ids or self._index is None:
            return 0
        with self._lock:
            return int(self._index.remove_ids(np.asarray(ids, dtype=np.int64)))

    def search(self, vector: np.ndarray, k: int) -> list[tuple[int, float]]:
        with self._lock:
            if self._index is None or self._index.ntotal == 0:
                return []
            k = min(k, self._index.ntotal)
            scores, ids = self._index.search(np.asarray([vector], dtype=np.float32), k)
            return [(int(i), float(s)) for i, s in zip(ids[0], scores[0], strict=True) if i != -1]

    def count(self) -> int:
        return 0 if self._index is None else int(self._index.ntotal)

    def ids(self) -> set[int]:
        with self._lock:
            if self._index is None or self._index.ntotal == 0:
                return set()
            return set(self._faiss.vector_to_array(self._index.id_map).tolist())


class NumpyVectorStore(VectorStore):
    backend = "numpy"

    def __init__(self, directory: Path):
        self._ids = np.zeros((0,), dtype=np.int64)
        self._vectors = np.zeros((0, 0), dtype=np.float32)
        super().__init__(directory)

    @property
    def vectors_path(self) -> Path:
        return self.directory / "numpy.vectors.npy"

    @property
    def ids_path(self) -> Path:
        return self.directory / "numpy.ids.npy"

    def _reset_storage(self, dim: int) -> None:
        self._ids = np.zeros((0,), dtype=np.int64)
        self._vectors = np.zeros((0, dim), dtype=np.float32)

    def load(self) -> bool:
        with self._lock:
            meta = self._read_meta()
            if not meta or not self.vectors_path.exists() or not self.ids_path.exists():
                return False
            self._vectors = np.load(self.vectors_path, allow_pickle=False)
            self._ids = np.load(self.ids_path, allow_pickle=False)
            self.fingerprint, self.dim = meta.get("fingerprint"), meta.get("dim")
            return True

    def save(self) -> None:
        with self._lock:
            for path, array in ((self.vectors_path, self._vectors), (self.ids_path, self._ids)):
                tmp = path.with_name(path.name + ".tmp.npy")
                np.save(tmp, array, allow_pickle=False)
                os.replace(tmp, path)
            self._write_meta()

    def add(self, ids: list[int], vectors: np.ndarray) -> None:
        if not ids:
            return
        with self._lock:
            self._vectors = np.vstack([self._vectors, vectors.astype(np.float32)])
            self._ids = np.concatenate([self._ids, np.asarray(ids, dtype=np.int64)])

    def remove(self, ids: list[int]) -> int:
        with self._lock:
            mask = ~np.isin(self._ids, np.asarray(ids, dtype=np.int64))
            removed = int((~mask).sum())
            self._ids, self._vectors = self._ids[mask], self._vectors[mask]
            return removed

    def search(self, vector: np.ndarray, k: int) -> list[tuple[int, float]]:
        with self._lock:
            if len(self._ids) == 0:
                return []
            scores = self._vectors @ vector.astype(np.float32)
            order = np.argsort(-scores)[:k]
            return [(int(self._ids[i]), float(scores[i])) for i in order]

    def count(self) -> int:
        return int(len(self._ids))

    def ids(self) -> set[int]:
        return set(self._ids.tolist())


def build_vector_store(name: str, directory: Path) -> VectorStore:
    if name == "numpy":
        return NumpyVectorStore(directory)
    return FaissVectorStore(directory)
