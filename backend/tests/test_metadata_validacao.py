
import pytest

from app.services.ingestion import build_metadata, DiscoveredFile


def _make_file(relative_path="doc.pdf"):
    """Create a minimal DiscoveredFile for tests."""
    return DiscoveredFile(
        origin="test",
        root=None,
        path=None,
        relative_path=relative_path,
        stored=False,
    )


def test_manifest_priority_title_author():
    manifest = {
        "doc.pdf": {
            "title": "Título Manifesto",
            "author": "Autor Manifesto",
        }
    }
    pdf = {
        "pdf_title": "Título PDF",
        "pdf_author": "Autor PDF",
    }

    meta = build_metadata(_make_file(), manifest, pdf)

    assert meta["title"] == "Título Manifesto"
    assert meta["author"] == "Autor Manifesto"


def test_fallback_to_pdf_when_missing_in_manifest():
    manifest = {"doc.pdf": {}}
    pdf = {
        "pdf_title": "Título PDF",
        "pdf_author": "Autor PDF",
    }

    meta = build_metadata(_make_file(), manifest, pdf)

    assert meta["title"] == "Título PDF"
    assert meta["author"] == "Autor PDF"


def test_no_pdf_metadata_uses_title_from_filename():
    manifest = {"doc.pdf": {}}

    meta = build_metadata(_make_file(), manifest, None)

    # title_from_filename turns "doc.pdf" into "doc"
    assert meta["title"] == "doc"

    # Author may be missing.
    assert "author" not in meta


def test_reliability_notes_from_manifest_only():
    manifest = {
        "doc.pdf": {
            "reliability_notes": ["nota1", "nota2"],
            "institution": "Instituto XYZ",
            "source_uri": "http://exemplo.com",
        }
    }

    meta = build_metadata(_make_file(), manifest, None)

    assert meta["reliability_notes"] == ["nota1", "nota2"]


def test_reliability_notes_string_and_list():
    manifest_str = {
        "doc.pdf": {
            "reliability_notes": "única nota",
            "institution": "Instituto XYZ",
            "source_uri": "http://exemplo.com",
        }
    }

    meta_str = build_metadata(_make_file(), manifest_str, None)

    assert meta_str["reliability_notes"] == "única nota"

    manifest_list = {
        "doc.pdf": {
            "reliability_notes": ["a", "b"],
            "institution": "Instituto XYZ",
            "source_uri": "http://exemplo.com",
        }
    }

    meta_list = build_metadata(_make_file(), manifest_list, None)

    assert meta_list["reliability_notes"] == ["a", "b"]


def test_deduplication_and_order():
    manifest = {
        "doc.pdf": {
            "reliability_notes": [
                "primeira",
                "segunda",
                "primeira",
                "terceira",
            ],
            "institution": "Instituto XYZ",
            "source_uri": "http://exemplo.com",
        }
    }

    meta = build_metadata(_make_file(), manifest, None)

    assert meta["reliability_notes"] == [
        "primeira",
        "segunda",
        "terceira",
    ]


def test_missing_institution_and_source_uri():
    manifest = {"doc.pdf": {}}

    meta = build_metadata(_make_file(), manifest, None)
    notes = meta.get("reliability_notes")

    assert "Instituição não identificada" in notes
    assert "Fonte não identificada" in notes


def test_missing_institution_only():
    manifest = {
        "doc.pdf": {
            "source_uri": "http://exemplo.com",
        }
    }

    meta = build_metadata(_make_file(), manifest, None)
    notes = meta.get("reliability_notes")

    assert "Instituição não identificada" in notes
    assert "Fonte não identificada" not in notes


def test_missing_source_uri_only():
    manifest = {
        "doc.pdf": {
            "institution": "Instituto XYZ",
        }
    }

    meta = build_metadata(_make_file(), manifest, None)
    notes = meta.get("reliability_notes")

    assert "Fonte não identificada" in notes
    assert "Instituição não identificada" not in notes


@pytest.mark.parametrize(
    "field,value",
    [
        ("temporal_limit", "2025-12-31"),
        ("valid_until", "2024-01-01"),
    ],
)
def test_temporal_valid_adds_alert(field, value):
    manifest = {"doc.pdf": {field: value}}

    meta = build_metadata(_make_file(), manifest, None)
    notes = meta.get("reliability_notes")

    assert "Revisão de atualidade recomendada" in notes


@pytest.mark.parametrize(
    "value",
    [
        "",
        "   ",
        None,
        "not-a-date",
    ],
)
def test_temporal_invalid_no_alert(value):
    manifest = {
        "doc.pdf": {
            "temporal_limit": value,
            "institution": "Instituto XYZ",
            "source_uri": "http://exemplo.com",
        }
    }

    meta = build_metadata(_make_file(), manifest, None)
    notes = meta.get("reliability_notes")

    if isinstance(notes, list):
        assert "Revisão de atualidade recomendada" not in notes
    else:
        assert notes is None or notes != "Revisão de atualidade recomendada"


def test_metadata_origin_preserved_when_manifest_used():
    manifest = {
        "doc.pdf": {
            "title": "Título",
            "author": "Autor",
        }
    }

    meta = build_metadata(_make_file(), manifest, None)

    assert meta["metadata_origin"] == "manifesto"


def test_metadata_origin_fallback_to_pdf():
    manifest = {"doc.pdf": {}}
    pdf = {
        "pdf_title": "Título PDF",
        "pdf_author": "Autor PDF",
    }

    meta = build_metadata(_make_file(), manifest, pdf)

    # Origin should be "pdf" because title/author came from PDF.
    assert meta["metadata_origin"] == "pdf"
