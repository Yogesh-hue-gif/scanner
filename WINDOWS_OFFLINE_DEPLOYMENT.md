# SpecGuard — Windows x64 Offline Conda-Pack Deployment Architecture

**Product Name:** SpecGuard  
**Version:** 1.0.0  
**Target Platform:** Windows x64 (Windows 10, Windows 11, Windows Server 2016+)  
**Deployment Modality:** Conda-Pack Portable Environment (`specguard-conda.tar.gz`)  
**Network Mode:** 100% Offline Air-Gapped / Intranet LAN  
**Zero External Dependencies:** No Docker, No Render, No Cloud APIs, No Node.js, No npm, No pip, No Anaconda Navigator required on target machine.  

---

## 1. System Architecture Overview

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      TARGET MACHINE: WINDOWS x64                       │
 │                   (Air-Gapped / Zero Internet Access)                  │
 └────────────────────────────────────────────────────────────────────────┘
                                     │
             ┌───────────────────────▼───────────────────────┐
             │       SpecGuard-Offline-Conda Portable        │
             │       CHECK_SPECguard.bat / START_SPECguard   │
             └───────────────────────┬───────────────────────┘
                                     │
             ┌───────────────────────▼───────────────────────┐
             │      Portable Python 3.11.16 Runtime          │
             │    (Unpacked from specguard-conda.tar.gz)     │
             │    Native C-Runtimes & VC++ Redistributable   │
             └───────────────────────┬───────────────────────┘
                                     │
             ┌───────────────────────▼───────────────────────┐
             │            FastAPI / Uvicorn (ASGI)           │
             │        Local HTTP Web Server (:8765)          │
             │    Binds: 127.0.0.1 (Local) & 0.0.0.0 (LAN)   │
             └───────┬───────────────────────────────┬───────┘
                     │                               │
 ┌───────────────────▼───────────┐   ┌───────────────▼───────────────────┐
 │   Document Processing Engine   │   │     Local Web Inspection UI       │
 │   • PyMuPDF (PDF AST & Render) │   │   • 100% Local JavaScript / CSS   │
 │   • python-docx (Native XML)   │   │   • Zero CDN / Zero Remote Fonts  │
 │   • OpenCV & Tesseract OCR     │   │   • High-DPI Multi-Page Viewer    │
 │   • 16 Engineering Analyzers   │   │   • Vector Defect Overlays        │
 │   • Tolerance Index Calculator │   │   • Exact Finding Navigation      │
 │   • ReportLab PDF Generator    │   │   • Audit-Ready PDF Certificate   │
 └───────────────────┬───────────┘   └───────────────┬───────────────────┘
                     │                               │
                     └───────────────┬───────────────┘
                                     │
             ┌───────────────────────▼───────────────────────┐
             │             data/ (Persistent Storage)        │
             │   • data/database/specguard.db (SQLite WAL)   │
             │   • data/uploads/ (Original Unmodified Files) │
             │   • data/reports/ (Generated Audit PDFs)      │
             │   • data/logs/ (Application Diagnostic Logs)  │
             └───────────────────────────────────────────────┘
```

---

## 2. Directory Layout

```text
SpecGuard-Offline-Conda/
│
├── environment/
│   └── specguard-conda.tar.gz    (Pre-built self-contained Windows x64 Conda runtime)
│
├── app/
│   ├── app.py                    (Server entrypoint)
│   ├── run_web.py                (Development launcher)
│   ├── check_specguard.py        (Pre-flight diagnostic runner)
│   ├── specguard/                (Core inspection engines, analyzers, APIs)
│   ├── rules/                    (Engineering rule bases: ASME, IEEE, ISO)
│   ├── standards/                (Domain engineering standards)
│   ├── templates/                (Document layout AST definitions)
│   ├── models/                   (Offline PyTorch & ONNX checkpoints)
│   └── static/                   (Local frontend assets: CSS, JS, SVG)
│
├── runtime/
│   └── tesseract/                (Bundled Windows x64 Tesseract OCR & tessdata)
│
├── data/
│   ├── database/                 (SQLite database: specguard.db)
│   ├── uploads/                  (Uploaded documents — never modified)
│   ├── reports/                  (Generated PDF compliance certificates)
│   ├── logs/                     (Runtime application logs)
│   └── repository/               (Document comparison archives)
│
├── START_SPECguard.bat           (Production launcher — auto-unpacks & binds 0.0.0.0:8765)
├── STOP_SPECguard.bat            (Safe shutdown script for port 8765)
├── CHECK_SPECguard.bat           (7-point pre-flight deployment diagnostic)
├── environment.yml               (Pinned Conda environment definition)
├── MODEL_MANIFEST.json           (122 local model checkpoints & SHA-256 digests)
├── CONDA_RUNTIME_AUDIT.md        (Runtime dependency audit & native DLL manifest)
├── OFFLINE_TEST_REPORT.md        (Subsystem verification & offline test log)
├── WINDOWS_OFFLINE_DEPLOYMENT.md (This deployment architecture document)
├── README.txt                    (Non-technical user manual)
└── SHA256SUMS.txt                (Cryptographic package integrity hashes)
```

---

## 3. End-User Workflow on Clean Windows PC

1. **Extraction:**
   Extract `SpecGuard-Offline-Conda.zip` to any local folder (e.g. `C:\SpecGuard`).
2. **Pre-flight Check:**
   Run `CHECK_SPECguard.bat`. This automatically:
   - Unpacks the Conda-Pack runtime if not previously unpacked.
   - Imports all 16 runtime libraries (FastAPI, PyMuPDF, OpenCV, PyTorch, ONNX Runtime, etc.).
   - Validates model checkpoints, rule bases, and templates.
   - Verifies 100% local web assets and SQLite database read/write access.
3. **Server Launch:**
   Run `START_SPECguard.bat`.
   - Starts the server on `0.0.0.0:8765`.
   - Opens local UI at `http://localhost:8765`.
4. **LAN Team Access:**
   - Any workstation on the local network accesses: `http://<HOST-IP>:8765`.
   - Zero software required on client machines (pure modern HTML5/ES6 browser).
5. **Clean Shutdown:**
   Run `STOP_SPECguard.bat` to terminate the process cleanly without affecting unrelated Python instances.

---

## 4. Key Guarantees

- **Original Document Immutability:** Uploaded source files are never modified. Defect highlights are rendered strictly as dynamic UI overlays.
- **Truthful Missing-Content Markers:** Missing text, missing figures, or absent sections use `EXPECTED_LOCATION` indicators rather than fabricated bounding box coordinates.
- **Persistent State:** Sessions, findings, defect markers, and tolerance scores survive browser refreshes, route transitions, and server restarts.
- **Zero Cloud Leakage:** All static assets, fonts, models, and OCR engines are bundled locally. Network isolation verified.
