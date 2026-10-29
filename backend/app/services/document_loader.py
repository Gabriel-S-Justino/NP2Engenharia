"""Leitura de documentos PDF e TXT preservando a página de origem.

O conteúdo lido é tratado apenas como dado: nada é executado ou interpretado como
instrução. Novos formatos podem ser adicionados registrando um leitor em `LOADERS`.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from pypdf import PdfReader
from pypdf.errors import PdfReadError

logger = logging.getLogger("acervo.loader")

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md"}
PDF_MAGIC = b"%PDF-"


class DocumentReadError(Exception):
    """Falha de leitura com mensagem pública (sem caminhos locais)."""


@dataclass
class PageText:
    page: int | None  # None quando o formato não tem paginação (ex.: TXT sem quebras de página)
    text: str


@dataclass
class LoadedDocument:
    pages: list[PageText]
    file_type: str
    metadata: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    @property
    def page_count(self) -> int | None:
        if self.file_type == "pdf":
            return len(self.pages)
        numbered = [p.page for p in self.pages if p.page is not None]
        return max(numbered) if numbered else None


def _ocr_page(page) -> str:  # pragma: no cover - depende de Tesseract instalado
    """OCR opcional (OCR_ENABLED=true). Requer `pytesseract`, `Pillow` e o binário Tesseract."""
    import io

    import pytesseract
    from PIL import Image

    texts = []
    for image in page.images:
        with Image.open(io.BytesIO(image.data)) as img:
            texts.append(pytesseract.image_to_string(img, lang="por"))
    return "\n".join(texts)


def load_pdf(path: Path, *, ocr_enabled: bool = False) -> LoadedDocument:
    with path.open("rb") as fh:
        if fh.read(5) != PDF_MAGIC:
            raise DocumentReadError("O arquivo não possui assinatura PDF válida.")
    try:
        reader = PdfReader(str(path), strict=False)
        if reader.is_encrypted:
            try:
                if not reader.decrypt(""):
                    raise DocumentReadError("PDF protegido por senha; não é possível extrair o texto.")
            except Exception as exc:  # noqa: BLE001 - pypdf lança tipos variados
                raise DocumentReadError("PDF protegido por senha; não é possível extrair o texto.") from exc
        pages: list[PageText] = []
        warnings: list[str] = []
        empty_pages: list[int] = []
        for index, page in enumerate(reader.pages, start=1):
            try:
                text = page.extract_text() or ""
            except Exception:  # noqa: BLE001
                text = ""
                warnings.append(f"Falha ao extrair texto da página {index}.")
            if not text.strip() and ocr_enabled:
                try:
                    text = _ocr_page(page)
                    if text.strip():
                        warnings.append(f"Página {index} extraída por OCR; revise a qualidade do texto.")
                except Exception:  # noqa: BLE001
                    warnings.append(f"OCR indisponível ou falhou na página {index}.")
            if not text.strip():
                empty_pages.append(index)
            pages.append(PageText(page=index, text=text))
        if empty_pages:
            listed = ", ".join(map(str, empty_pages[:10])) + ("…" if len(empty_pages) > 10 else "")
            warnings.append(
                f"{len(empty_pages)} página(s) sem texto extraível ({listed}). "
                "Pode ser um PDF digitalizado; o OCR é opcional (OCR_ENABLED)."
            )
        metadata = {}
        info = reader.metadata or {}
        for key, target in (("/Title", "pdf_title"), ("/Author", "pdf_author"), ("/CreationDate", "pdf_created")):
            value = info.get(key)
            if value:
                metadata[target] = str(value).strip()
        return LoadedDocument(pages=pages, file_type="pdf", metadata=metadata, warnings=warnings)
    except DocumentReadError:
        raise
    except (PdfReadError, OSError, ValueError, KeyError) as exc:
        logger.warning("pdf_ilegivel", extra={"erro": type(exc).__name__})
        raise DocumentReadError("Não foi possível ler o PDF: arquivo corrompido ou em formato não suportado.") from exc


def decode_text(raw: bytes) -> tuple[str, list[str]]:
    if b"\x00" in raw:
        raise DocumentReadError("O arquivo de texto contém bytes binários; não parece ser texto puro.")
    for encoding in ("utf-8-sig", "utf-8"):
        try:
            return raw.decode(encoding), []
        except UnicodeDecodeError:
            continue
    return raw.decode("cp1252", errors="replace"), [
        "Arquivo não estava em UTF-8; foi lido como Windows-1252. Verifique acentuação."
    ]


def load_text(path: Path) -> LoadedDocument:
    text, warnings = decode_text(path.read_bytes())
    file_type = path.suffix.lower().lstrip(".")
    # Caractere de quebra de página (form feed) permite preservar páginas em TXT.
    if "\f" in text:
        pages = [PageText(page=i, text=part) for i, part in enumerate(text.split("\f"), start=1)]
    else:
        pages = [PageText(page=None, text=text)]
        warnings.append("Arquivo de texto sem paginação: as citações não terão número de página.")
    return LoadedDocument(pages=pages, file_type=file_type, warnings=warnings)


LOADERS: dict[str, Callable[..., LoadedDocument]] = {
    ".pdf": load_pdf,
    ".txt": load_text,
    ".md": load_text,
}


def load_document(path: Path, *, ocr_enabled: bool = False) -> LoadedDocument:
    suffix = path.suffix.lower()
    if suffix not in LOADERS:
        raise DocumentReadError(f"Formato '{suffix}' não suportado.")
    if suffix == ".pdf":
        return load_pdf(path, ocr_enabled=ocr_enabled)
    return LOADERS[suffix](path)
