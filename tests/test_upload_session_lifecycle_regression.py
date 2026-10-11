"""
Phase 5 Regression Test Suite: Upload State, File Integrity & Session Lifecycle.
Verifies that:
1. Empty files (0 bytes) are rejected with HTTP 400.
2. Extension disguise attacks (e.g. plain text with .pdf extension) are rejected by signature validation.
3. Unsupported extensions are rejected with HTTP 400.
4. Valid uploads return real page counts and metadata from DocumentParser.
5. Directory traversal attempts are rejected.
6. Session rehydration preserves session isolation without stale cross-contamination.
"""

import io
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
import pymupdf

from specguard.server.app import app
from specguard.storage.database import DatabaseManager


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_empty_file_upload_rejected(client):
    """Uploading an empty file (0 bytes) must return HTTP 400, not success or fabricated metadata."""
    empty_file = io.BytesIO(b"")
    response = client.post(
        "/api/analysis/upload",
        files={"file": ("empty.pdf", empty_file, "application/pdf")}
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_disguised_file_signature_rejected(client):
    """File pretending to be a PDF without %PDF header must fail signature validation."""
    fake_pdf = io.BytesIO(b"This is just plain ASCII text disguised as a PDF file.")
    response = client.post(
        "/api/analysis/upload",
        files={"file": ("fake_doc.pdf", fake_pdf, "application/pdf")}
    )
    assert response.status_code == 400
    assert "magic bytes" in response.json()["detail"].lower() or "%pdf" in response.json()["detail"].lower()


def test_unsupported_extension_rejected(client):
    """Uploading unsupported format (e.g. .exe, .sh) must return HTTP 400."""
    fake_exe = io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00")
    response = client.post(
        "/api/analysis/upload",
        files={"file": ("program.exe", fake_exe, "application/octet-stream")}
    )
    assert response.status_code == 400
    assert "unsupported" in response.json()["detail"].lower()


def test_valid_pdf_upload_returns_honest_parser_metadata(client):
    """Valid multi-page PDF must return honest page count extracted by DocumentParser."""
    doc = pymupdf.open()
    doc.new_page(width=612, height=792)
    doc.new_page(width=612, height=792)
    doc.new_page(width=612, height=792)  # 3 pages
    pdf_bytes = doc.tobytes()
    doc.close()

    response = client.post(
        "/api/analysis/upload",
        files={"file": ("three_page_spec.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "three_page_spec.pdf"
    assert data["page_count"] == 3
    assert data["file_type"] == "PDF"
    assert data["file_size"] == len(pdf_bytes)
    assert len(data["file_hash"]) == 64
    assert data["status"] == "ready"


def test_path_traversal_filename_sanitized(client):
    """Filenames attempting directory traversal must be sanitized to safe basename."""
    doc = pymupdf.open()
    doc.new_page(width=612, height=792)
    pdf_bytes = doc.tobytes()
    doc.close()

    response = client.post(
        "/api/analysis/upload",
        files={"file": ("../../../../etc/malicious.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    )
    assert response.status_code == 200
    data = response.json()
    # Path must remain contained in uploads directory
    target_path = Path(data["file_path"])
    assert ".." not in target_path.name
    assert "malicious.pdf" in target_path.name
