# DOCREADY — WINDOWS x64 OFFLINE EDITION v1.0
## Offline Engineering Document Readiness Verification Platform

**Product:** DocReady  
**Release:** v1.0.0 Windows x64 Standalone Offline Edition  
**Platform Target:** Windows 10 x64 / Windows 11 x64  
**Network Security:** 100% Air-Gapped Standalone & Isolated Intranet (Zero Cloud Dependencies)  
**Default Binding:** `http://127.0.0.1:8765`  

---

## 1. PRODUCT OVERVIEW

DocReady is a high-assurance engineering document readiness and compliance verification platform designed specifically for secure, air-gapped engineering environments. It performs deep structural analysis, computer vision layout parsing, mathematical proposition extraction, Table of Contents drift verification, engineering parameter unit normalization, and standards compliance checking across technical documents.

### Key Capabilities
- **10 Autonomous Analysis Engines:**
  1. *Formatting Analyzer:* Page margins, typography hierarchies, line spacing, header/footer zones.
  2. *Structural Hierarchy Analyzer:* Section numbering trees (1.0, 1.1, I.A), heading integrity.
  3. *Table of Contents Engine:* Precise page drift calculation, title matching, orphan detection.
  4. *Engineering Table Analyzer:* Column alignment, multi-page continuation, header preservation.
  5. *Technical Grammar & Vocabulary:* Engineering spelling, duplicate word detection, jargon linting.
  6. *Parameter Extraction & Unit Normalizer:* SI and Imperial unit conversions, operating conditions.
  7. *Fixed Template Analyzer:* Required clauses, mandatory section completeness schemas.
  8. *Semantic Ambiguity Engine:* Unmeasurable requirements, conflicting statements, fuzzy qualifiers.
  9. *Logical Consistency Analyzer:* Cross-page numerical and parameter contradiction detection.
  10. *Local Standards Compliance:* ASME Y14 / GD&T, IEC 60364, Process Safety P&ID, and IEEE rules.
- **Multi-Format Ingestion:** Native support for PDF, DOCX, XLSX, TXT, PNG, JPG, and TIFF.
- **Air-Gapped Privacy:** Zero telemetry, zero online license checks, zero external CDN links.
- **Local Persistence:** High-integrity SQLite database stored entirely on local disk.

---

## 2. SYSTEM REQUIREMENTS

- **Operating System:** Windows 10 64-bit (Build 19041 or higher) or Windows 11 64-bit.
- **Hardware Architecture:** x86_64 CPU with AVX instruction support.
- **System Memory (RAM):** 4 GB minimum (8 GB recommended for 50+ page documents).
- **Disk Storage:** 2 GB free disk space for runtime, models, and cache.
- **Browser:** Any modern offline browser (Microsoft Edge, Google Chrome, Mozilla Firefox).
- **External Dependencies:** NONE. The runtime is self-contained. Python, Node.js, and Docker are NOT required on the target PC.

---

## 3. QUICK START LAUNCH INSTRUCTIONS

### Step 1: Extract the Distribution
Extract `DocReady-v1.0.0-Windows-x64.zip` into your preferred local directory (e.g. `C:\DocReady\` or `D:\Engineering\DocReady\`).

### Step 2: Launch DocReady
Double-click:
```bat
Launch_DocReady.bat
```
The launcher will automatically:
1. Resolve local installation paths and configure writable data directories.
2. Initialize the packed offline Python runtime.
3. Validate database read/write access and model manifests.
4. Start the background API service on `127.0.0.1:8765`.
5. Wait for genuine service health readiness.
6. Open your default web browser directly to the DocReady Home interface (`http://127.0.0.1:8765/#home`).

### Step 3: Shutdown
To cleanly stop the application, return to the launcher command window and press `CTRL+C` or close the window.

---

## 4. OFFLINE ACCEPTANCE & INTEGRITY VERIFICATION

To verify application integrity and confirm standalone compliance before conducting operational audits:

Run the acceptance diagnostic script:
```bat
Verify_Offline.bat
```
This script executes 5 automated diagnostics:
1. Native library imports (`PyMuPDF`, `OpenCV`, `python-docx`, `openpyxl`, `FastAPI`, `PyTorch`).
2. Model inventory checksum verification against `MODEL_INVENTORY.json`.
3. Local SQLite database read and write access validation.
4. Execution of Phase 4 (PDF layout & figure extraction) and Phase 5 (upload state lifecycle) regression test suites.
5. Complete end-to-end analysis of a baseline mechanical engineering specification document.

When all checks pass, you will receive confirmation:
```
===============================================================================
  OFFLINE ACCEPTANCE VERIFICATION: ALL 5 CHECKS PASSED (100% COMPLIANT)
  DocReady Windows x64 is verified ready for standalone air-gapped deployment.
===============================================================================
```

---

## 5. REPRODUCIBLE RELEASE CHECKSUMS

Every release includes `MANIFEST.sha256` containing SHA-256 cryptographic hashes for all application files and binaries. To verify integrity on Windows PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 DocReady-v1.0.0-Windows-x64.zip
```

---

## 6. OFFLINE SECURITY & INTRANET POLICY

1. **Standalone Loopback Default:** The application binds strictly to `127.0.0.1:8765`. It does not listen on external network interfaces (`0.0.0.0`) by default.
2. **Intranet Mode (Optional):** If multi-user LAN access is required across an isolated engineering intranet, launch via:
   ```bat
   set DOCREADY_HOST=0.0.0.0
   Launch_DocReady.bat
   ```
   Ensure corporate firewall policies restrict access to authorized engineering subnets.
3. **Data Containment:** Uploaded files, database records, and generated audit reports remain on local disk under `data/`. No data leaves the host machine.

---

## 7. KNOWN LIMITATIONS & SCOPE

- **Cursive Handwriting:** Freeform unstandardized handwritten notes on scanned field forms are flagged as visual annotations but cannot be guaranteed for 100% transcription without human review.
- **CAD Formats:** Native CAD drawings (`.dwg`, `.dxf`) must be exported to PDF or high-resolution TIFF/PNG prior to analysis (native vector layer CAD parsing scheduled for v1.1).
- **Severely Corrupted Files:** PDF documents with completely missing header blocks and truncated xref tables will be rejected with an honest validation error rather than fabricated results.

---

## 8. DIRECTORY STRUCTURE

```
DocReady-Windows-x64/
├── app.py                      # Application CLI entry point
├── run_web.py                  # Local web server runner
├── Launch_DocReady.bat         # One-click Windows offline launcher
├── Verify_Offline.bat          # Offline acceptance test script
├── README_OFFLINE.md           # User guide and operating manual
├── MANIFEST.sha256             # Release SHA-256 checksum manifest
├── MODEL_INVENTORY.json        # Bundled models and integrity specs
├── specguard/                  # Core application source code
│   ├── analyzers/              # The 10 verification engines
│   ├── core/                   # Ingestion, models, CV layout, profiles
│   ├── server/                 # FastAPI REST API services
│   ├── storage/                # SQLite database and repositories
│   └── web/                    # Offline vanilla JS, CSS, and HTML SPA
├── rules/                      # Local ASME, IEC, IEEE rulesets
├── standards/                  # Local engineering tolerance profiles
├── templates/                  # Document structure templates
├── demo_samples/               # Verified evaluation sample files
├── data/                       # Local SQLite database and upload storage
└── logs/                       # Application execution and diagnostic logs
```

---

*DocReady Offline Engineering Document Readiness Verification — Windows x64 v1.0*  
*Developed for High-Assurance Engineering Environments*
