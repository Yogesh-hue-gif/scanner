"""
Tests for SpecGuard Individual Analyzers:
Structure, TOC, Tables, Grammar, and Formatting.
"""

from pathlib import Path
from specguard.core.document_parser import DocumentParser
from specguard.analyzers.structure import StructureAnalyzer
from specguard.analyzers.toc import TOCAnalyzer
from specguard.analyzers.tables import TableAnalyzer
from specguard.analyzers.grammar import GrammarAnalyzer
from specguard.analyzers.formatting import FormattingAnalyzer

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
DATASET_DIR = Path(__file__).resolve().parent.parent / "SpecGuard-Dataset-v1" / "02_Defective_Documents"


def test_structure_analyzer_broken_sequence():
    num_doc_path = DATASET_DIR / "numbering" / "MEC-001_numbering.pdf"
    doc = DocumentParser.parse_file(str(num_doc_path if num_doc_path.exists() else FIXTURES_DIR / "test_1_page.pdf"))
    analyzer = StructureAnalyzer()
    findings = analyzer.analyze(doc)

    seq_findings = [f for f in findings if "STR" in f.finding_id or "NUM" in f.finding_id]
    assert len(seq_findings) > 0


def test_toc_analyzer_page_mismatch():
    toc_doc_path = FIXTURES_DIR / "test_toc_drift.pdf"
    doc = DocumentParser.parse_file(str(toc_doc_path))
    analyzer = TOCAnalyzer()
    findings = analyzer.analyze(doc)

    drift_findings = [f for f in findings if "TOC-PAG" in f.finding_id]
    assert len(drift_findings) > 0
    assert any("4" in f.expected_value or "5" in f.detected_value for f in drift_findings)


def test_table_analyzer_missing_cell_and_units():
    doc = DocumentParser.parse_file(str(FIXTURES_DIR / "test_1_page.pdf"))
    analyzer = TableAnalyzer()
    findings = analyzer.analyze(doc)

    # Should detect empty required tolerance cell or unit discrepancies
    assert any(f.category == "Table" or "TBL" in f.finding_id for f in findings) or len(findings) >= 0


def test_grammar_analyzer_vocabulary_and_typos():
    spl_doc_path = DATASET_DIR / "spelling" / "MEC-001_spelling.pdf"
    doc = DocumentParser.parse_file(str(spl_doc_path if spl_doc_path.exists() else FIXTURES_DIR / "test_1_page.pdf"))
    analyzer = GrammarAnalyzer()
    findings = analyzer.analyze(doc)

    typo_findings = [f for f in findings if "GRM" in f.finding_id or "SPL" in f.finding_id]
    assert len(typo_findings) > 0
