"""Regressões encontradas com listas e penalidades do acervo real."""

from app.services.evidence import TermStatistics
from app.services.generation import EvidenceSource, ExtractiveDemoGenerator


def test_legal_list_keeps_condition_and_matching_value():
    text = (
        "Art. 61. Onde não existir sinalização regulamentadora, a velocidade máxima será de: "
        "a) oitenta quilômetros por hora, nas vias de trânsito rápido; "
        "b) trinta quilômetros por hora, nas vias locais; "
        "O órgão competente poderá regulamentar velocidades por sinalização."
    )
    source = EvidenceSource("F1", "s1", "CTB", 23, "Art. 61", text, 0.9)
    output = ExtractiveDemoGenerator().generate(
        "Qual a velocidade máxima nas vias locais sem sinalização?", [source], TermStatistics([text])
    )
    assert "trinta quilômetros por hora, nas vias locais" in output.text
    assert "Onde não existir sinalização" in output.text
    assert "poderá regulamentar" in output.text
    assert "[F1]" in output.text


def test_legal_penalty_keeps_amount_and_recurrence_exception():
    text = (
        "Art. 165. Dirigir sob a influência de álcool: Infração - gravíssima; "
        "Penalidade - multa (dez vezes) e suspensão por 12 meses. "
        "Parágrafo único. Aplica-se em dobro a multa em caso de reincidência em até 12 meses."
    )
    source = EvidenceSource("F1", "s1", "CTB", 57, "Art. 165", text, 0.9)
    output = ExtractiveDemoGenerator().generate(
        "Qual a penalidade por dirigir sob influência de álcool?", [source], TermStatistics([text])
    )
    assert "multa (dez vezes)" in output.text
    assert "suspensão por 12 meses" in output.text
    assert "em dobro" in output.text
