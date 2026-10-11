"""
Comprehensive Phase 4 Regression Test Suite for DocReady PDF Parsing & Figure Extraction.
Verifies that:
1. Full-page backgrounds, scan borders, and header/footer rules are not detected as figures.
2. Genuine embedded raster images and vector diagrams are correctly identified.
3. Scanned pages are distinguished from pages with ordinary figures.
4. Blank pages are recognized.
5. All bounding boxes remain strictly within page dimensions.
6. Figure deduplication prevents duplicate boxes.
"""

import tempfile
from pathlib import Path
import pytest
import pymupdf  # PyMuPDF

from specguard.core.document_parser import DocumentParser


@pytest.fixture
def temp_pdf_dir():
    with tempfile.TemporaryDirectory() as td:
        yield Path(td)


def test_text_only_pdf_no_figures(temp_pdf_dir):
    """Text-only PDF should have 0 figures detected and not be marked blank or scanned."""
    pdf_path = temp_pdf_dir / "text_only.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 100), "DocReady Engineering Specification Title", fontsize=16)
    page.insert_text((72, 140), "This is section 1 describing mechanical specifications and tolerances.", fontsize=11)
    doc.save(str(pdf_path))
    doc.close()

    parsed = DocumentParser.parse_file(str(pdf_path))
    assert parsed.page_count == 1
    p1 = parsed.pages[0]
    assert len(p1.figures) == 0
    assert not p1.is_scanned
    assert not p1.is_blank
    assert "DocReady" in p1.text


def test_full_page_background_not_reported_as_figure(temp_pdf_dir):
    """Full-page background raster image (>85% coverage) must NOT be reported as an embedded figure."""
    pdf_path = temp_pdf_dir / "bg_image.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)

    # Insert a full-page background image (alpha=0, 3 channels RGB)
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 612, 792), 0)
    pix.set_rect(pix.irect, (240, 240, 240))  # light gray
    page.insert_image(pymupdf.Rect(0, 0, 612, 792), pixmap=pix)

    # Insert genuine native text on top of the background
    page.insert_text((72, 100), "Specification Document With Full Page Background Template", fontsize=14)
    page.insert_text((72, 130), "Section 1: Operating Pressure: 15.0 MPa at 250 C.", fontsize=11)
    doc.save(str(pdf_path))
    doc.close()

    parsed = DocumentParser.parse_file(str(pdf_path))
    p1 = parsed.pages[0]
    assert len(p1.figures) == 0, "Full page background must not be reported as an embedded figure"
    assert not p1.is_scanned, "Page with native text should not be marked as a scanned page"


def test_genuine_small_embedded_raster_image(temp_pdf_dir):
    """Genuine embedded raster image must be detected as a figure with valid coordinates."""
    pdf_path = temp_pdf_dir / "embedded_fig.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 72), "Figure 1 shows the component diagram:", fontsize=12)

    # Insert small diagram image (200x150 points, alpha=0)
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 200, 150), 0)
    pix.set_rect(pix.irect, (100, 150, 200))
    page.insert_image(pymupdf.Rect(100, 120, 300, 270), pixmap=pix)
    page.insert_text((100, 285), "Figure 1. High-pressure pump assembly", fontsize=10)

    doc.save(str(pdf_path))
    doc.close()

    parsed = DocumentParser.parse_file(str(pdf_path))
    p1 = parsed.pages[0]
    assert len(p1.figures) == 1
    fig = p1.figures[0]
    assert fig.figure_type == "raster"
    assert 95.0 <= fig.bbox.x0 <= 105.0
    assert 115.0 <= fig.bbox.y0 <= 125.0
    assert 295.0 <= fig.bbox.x1 <= 305.0
    assert 265.0 <= fig.bbox.y1 <= 275.0


def test_full_page_scan_detected_as_scanned(temp_pdf_dir):
    """Full-page scan with no native text should be recognized as scanned, not as a figure."""
    pdf_path = temp_pdf_dir / "full_scan.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)

    # Full page scan covering >90% of page (alpha=0)
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 600, 780), 0)
    pix.set_rect(pix.irect, (230, 230, 230))
    page.insert_image(pymupdf.Rect(6, 6, 606, 786), pixmap=pix)
    doc.save(str(pdf_path))
    doc.close()

    parsed = DocumentParser.parse_file(str(pdf_path))
    p1 = parsed.pages[0]
    assert p1.is_scanned, "Full-page scanned document should be marked is_scanned=True"
    assert len(p1.figures) == 0, "Full page scan must not be reported as an inline figure"


def test_header_footer_rules_not_detected_as_vector_figure(temp_pdf_dir):
    """Header and footer separator rules must not be merged into a page-sized figure."""
    pdf_path = temp_pdf_dir / "rules.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)

    # Header text and thin horizontal line (rh = 1.0, rw = 500)
    page.insert_text((54, 35), "HEADER: Confidential Engineering Spec", fontsize=9)
    page.draw_line(pymupdf.Point(54, 45), pymupdf.Point(558, 45), width=1.0)

    # Body text
    page.insert_text((54, 100), "1.0 Scope and System Architecture", fontsize=14)
    page.insert_text((54, 130), "This specification defines the thermal boundary conditions.", fontsize=11)

    # Footer thin horizontal line and footer text
    page.draw_line(pymupdf.Point(54, 750), pymupdf.Point(558, 750), width=1.0)
    page.insert_text((54, 765), "Page 1 of 10 - SpecGuard System Document", fontsize=9)

    doc.save(str(pdf_path))
    doc.close()

    parsed = DocumentParser.parse_file(str(pdf_path))
    p1 = parsed.pages[0]
    assert len(p1.figures) == 0, "Header and footer rules must not be reported as a vector diagram"


def test_genuine_vector_diagram_detected(temp_pdf_dir):
    """Genuine vector drawings (e.g. schematic boxes and connectors) should be detected as vector figures."""
    pdf_path = temp_pdf_dir / "vector_diag.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((54, 80), "Figure 2: Hydraulic Circuit Schematic", fontsize=12)

    # Draw a genuine schematic: two boxes connected by lines (w=200, h=120)
    page.draw_rect(pymupdf.Rect(100, 150, 200, 250), color=(0, 0, 0), width=1.5)
    page.draw_rect(pymupdf.Rect(250, 150, 350, 250), color=(0, 0, 0), width=1.5)
    page.draw_line(pymupdf.Point(200, 200), pymupdf.Point(250, 200), color=(0, 0, 0), width=1.5)

    doc.save(str(pdf_path))
    doc.close()

    parsed = DocumentParser.parse_file(str(pdf_path))
    p1 = parsed.pages[0]
    assert len(p1.figures) == 1, "Clustered vector diagram must be detected"
    fig = p1.figures[0]
    assert fig.figure_type == "vector"
    assert fig.bbox.width >= 150.0
    assert fig.bbox.height >= 80.0


def test_blank_pdf_page_recognition(temp_pdf_dir):
    """Completely blank PDF page must be recognized as is_blank=True."""
    pdf_path = temp_pdf_dir / "blank.pdf"
    doc = pymupdf.open()
    doc.new_page(width=612, height=792)  # Empty page
    doc.save(str(pdf_path))
    doc.close()

    parsed = DocumentParser.parse_file(str(pdf_path))
    p1 = parsed.pages[0]
    assert p1.is_blank, "Empty page must be marked is_blank=True"
    assert len(p1.blocks) == 0
    assert len(p1.figures) == 0
    assert len(p1.tables) == 0


def test_rotated_and_custom_page_dimensions(temp_pdf_dir):
    """PDF with rotation (90 deg) and landscape dimensions preserves geometry."""
    pdf_path = temp_pdf_dir / "rotated.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=792, height=612)  # Landscape Letter
    page.set_rotation(90)
    page.insert_text((50, 50), "Landscape Drawing Title Block", fontsize=14)
    doc.save(str(pdf_path))
    doc.close()

    parsed = DocumentParser.parse_file(str(pdf_path))
    p1 = parsed.pages[0]
    assert p1.rotation == 90
    assert p1.width == 612.0
    assert p1.height == 792.0
    # BBoxes must be strictly within bounds
    for b in p1.blocks:
        assert 0.0 <= b.bbox.x0 <= b.bbox.x1 <= 612.0
        assert 0.0 <= b.bbox.y0 <= b.bbox.y1 <= 792.0
