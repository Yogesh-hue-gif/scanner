# SpecGuard — Production Repository Cleanup & Dead Code Audit Report

**Report Date:** 2026-09-29  
**Target Platform:** Windows x64 (`win-64`)  
**Deployment Modality:** 100% Offline Conda-Pack (`SpecGuard-Offline-Conda.zip`)  
**Status:** COMPLETE & VERIFIED  

---

## 1. Repository Inventory Summary

| Artifact Category | Files | Total Size | Description & Status |
|---|---|---|---|
| **Python Files (`.py`)** | 176 | 1.41 MB | Core inspection pipeline, 16 analyzers, FastAPI routers, storage, models |
| **Model Weights (`.pt`, `.onnx`, `.data`)** | 244 | 67.75 MB | 122 neural models & checkpoints (Domain, NER, Contradiction, Cross-Domain) |
| **Web Assets (`.js`, `.css`, `.html`)** | 80 | 1.02 MB | 100% local frontend, 14 views, 3 UI components, 5 stylesheets |
| **Knowledge Bases (`.json`, `.yaml`)** | 2,746 | 7.65 MB | ASME/IEEE/ISO rules, standards, AST layout templates, model registry |
| **Dataset & Benchmarks (`.pdf`, `.json`)** | 1,208 | 13.03 MB | `SpecGuard-Dataset-v1` (clean, defective, OCR, tolerance ground truths) |
| **Windows Executables & DLLs** | 198 | 87.30 MB | Portable Windows x64 Tesseract OCR (`tesseract.exe`, DLLs, `eng.traineddata`) |
| **Conda-Pack Distribution** | 2 | 2.5 GB | `specguard-conda.tar.gz` (1.2 GB) & `SpecGuard-Offline-Conda.zip` (1.2 GB) |
| **Documentation & Guides (`.md`, `.txt`)** | 20 | 0.11 MB | Windows offline manuals, audit manifests, architecture reports |
| **Deployment Launchers (`.bat`, `.sh`)** | 12 | 0.02 MB | `CHECK_SPECguard.bat`, `START_SPECguard.bat`, `STOP_SPECguard.bat` |

---

## 2. Deleted Unneeded Files & Folders

1. **Docker Infrastructure:**
   - `Dockerfile` — Obsolete Docker container definition.
   - `.dockerignore` — Obsolete Docker build ignore rules.
   - `docker-compose.yml` — Obsolete multi-container compose configuration.
   - `requirements-docker.txt` — Obsolete Docker container dependency list.

2. **Render Cloud Infrastructure:**
   - `render.yaml` — Obsolete Render cloud service specification.
   - `requirements-render.txt` — Obsolete Render-specific dependency file.
   - `docs/RENDER_DEPLOYMENT_GUIDE.md` — Obsolete cloud deployment documentation.
   - `docs/RENDER_READINESS_AUDIT.md` — Obsolete cloud readiness audit.
   - `docs/RENDER_TESTING_REPORT.md` — Obsolete cloud testing report.
   - `tests/test_render_deployment_simulation.py` — Obsolete cloud simulation test suite.

3. **Development Lab & Training Artifacts:**
   - `training/` (7 files & raw training data) — Training laboratory scripts (`train.py`, `evaluate.py`, `prepare_dataset.py`, `config.yaml`, `training_metrics.json`). Models are frozen and deployed in `models/`.
   - `create_demo_samples.py` & `generate_guide_pdf.py` — Obsolete scratch generator scripts.

4. **Ephemeral Caches & Generated Test Data:**
   - `repository/` (5,800+ comparison JSONs) — Generated comparison outputs from past benchmark runs. Runtime repository is now strictly managed under `data/repository/`.
   - `benchmark_results/` (11 past run outputs) — Generated benchmark run JSON logs from previous evaluation runs.
   - `ANALYSIS_SESSION_PERSISTENCE_FIX_REPORT.md` & `FINDINGS_PERSISTENCE_REGRESSION_REPORT.md` — Obsolete scratch debugging reports.
   - `DEPLOYMENT_ARCHITECTURE.md` — Superseded by `WINDOWS_OFFLINE_DEPLOYMENT.md`.
   - `SpecGuard-Benchmark-Report.md` (root copy) — Duplicate report.
   - `__pycache__/` (13 directories) — Ephemeral Python bytecode cache directories.
   - `*.pyc` (88 files) — Compiled Python bytecode files.
   - `.pytest_cache/` — Ephemeral pytest run state.

---

## 3. Deleted Modules & Code Blocks

| Target | Reason | Reference Check | Safe to Delete | Verification |
|---|---|---|---|---|
| `test_render_deployment_simulation.py` | Render cloud deployment simulation test. Docker and Render are removed from architecture. | No references in `specguard/` or active test suites. | YES | Pytest runs cleanly with zero collection errors. |
| `RENDER_DEMO` CORS branch in `specguard/server/app.py` | Cloud-specific origin allowance for `.onrender.com`. | Searched codebase for `RENDER_DEMO` and `onrender.com`. | YES | Localhost and private subnet regex handles all local and LAN traffic. |
| Dockerfile & docker-compose | Replaced exclusively by Conda-Pack Windows x64 deployment. | No build scripts depend on Docker. | YES | Full offline package runs via `START_SPECguard.bat`. |

---

## 4. API Routes Audit

All 10 active API routers registered in `specguard/server/app.py` are strictly required by the local web UI:

| Router | Prefix | Status | Purpose in SpecGuard |
|---|---|---|---|
| `router_dashboard` | `/api/dashboard` | **RETAINED** | Dashboard statistics, issue heatmap, recent sessions |
| `router_analysis` | `/api/analysis` | **RETAINED** | Upload document, start analysis pipeline, cancel, poll progress |
| `router_documents` | `/api/documents` | **RETAINED** | Document metadata, page image rasterization for canvas viewer |
| `router_findings` | `/api/findings` | **RETAINED** | Findings listing, finding details, bounding boxes, defect markers |
| `router_history` | `/api/history` | **RETAINED** | Session history, past inspection results |
| `router_reports` | `/api/reports` | **RETAINED** | PDF audit certificate generation, HTML & JSON exports |
| `router_standards` | `/api/standards` | **RETAINED** | Engineering standards catalog, active rules |
| `router_models` | `/api/models` | **RETAINED** | Local model registry, hardware & CPU/GPU diagnostics |
| `router_templates` | `/api/templates` | **RETAINED** | Document layout AST templates |
| `router_settings` | `/api/settings` | **RETAINED** | Storage usage, system diagnostics, configuration |

Zero unused API routes exist. Obsolete cloud endpoints have been eliminated.

---

## 5. Frontend Components Audit

The web frontend in `specguard/web/static/` is verified 100% local with zero CDN or cloud dependencies:
- **Views (14):** `dashboard.js`, `document_inspection.js`, `viewer.js`, `findings.js`, `results.js`, `content_issues.js`, `structural_issues.js`, `formatting.js`, `standards.js`, `reports.js`, `history.js`, `new_analysis.js`, `analysis_progress.js`, `settings.js`.
- **Components (3):** `document_viewer.js` (high-DPI multi-page canvas with zoom 100%-200% and vector overlays), `modal.js`, `toast.js`.
- **Core (4):** `app.js`, `router.js`, `state.js`, `api.js`.
- **Stylesheets (5):** `base.css`, `layout.css`, `components.css`, `views.css`, `findings.css`.
- **Obsolete Desktop / Workstation / Canvas Editor Artifacts:** Verified **0** desktop/workstation/editor artifacts. All canvas code belongs to the read-only high-DPI document inspection viewer.

---

## 6. Dependencies Audit

All dependencies are aligned and pinned across `pyproject.toml`, `requirements-conda.txt`, and `environment.yml`:
- **FastAPI** (`0.141.1`) & **Uvicorn** (`0.54.0`)
- **PyMuPDF** (`1.28.0`)
- **OpenCV** (`5.0.0`)
- **NumPy** (`2.4.6`) & **Pandas** (`3.0.6`)
- **PyTorch** (`2.13.0`)
- **ONNX** (`1.23.0`) & **ONNX Runtime** (`1.30.0`)
- **python-docx** (`1.2.0`) & **openpyxl** (`3.1.5`)
- **Pydantic** (`2.13.5`) & **PyYAML** (`6.0.3`)
- **psutil** (`7.2.2`), **Jinja2** (`3.1.6`), **python-multipart** (`0.0.32`)
- **ReportLab** (`4.4.10`) & **Pillow** (`11.3.0`)

No cloud, Docker, Render, or Node.js dependencies remain.

---

## 7. Preserved Components

1. **`SpecGuard-Dataset-v1/`**: Preserved in accordance with Phase 12 instructions ("DO NOT delete required benchmark datasets, test fixtures, sample documents").
2. **`models/`**: 122 validated neural network checkpoints and ONNX graphs.
3. **`rules/`, `standards/`, `templates/`**: Engineering knowledge bases.
4. **`data/`**: User persistent SQLite database and uploads storage.
5. **`SpecGuard-Offline-Conda/`**: The complete production Windows x64 distribution package.

---

## 8. Potential Dead Code Requiring Manual Review

| Item | Location | Context & Review Note |
|---|---|---|
| `docready.db` / `docready.log` fallback checks | `specguard/core/runtime_paths.py:99-116` | **Retained intentionally:** These lines check whether an existing user data directory contains legacy database/log files and gracefully alias them to `specguard.db` / `specguard.log`. They do not introduce new legacy state and guarantee data continuity. |
| `LibreOffice` detection | `specguard/core/docx_extractor.py:30-70` | **Retained as optional fallback:** Production DOCX parsing runs natively via `python-docx`. If a user installs LibreOffice on Windows, SpecGuard will optionally use it for pixel-perfect rasterization. |

---

## 9. Final Verification Results

- **Automated Tests:** 15/15 unit and API integration tests pass cleanly (`test_web_api.py`, `test_model_registry_integration.py`, `test_analyzers.py`).
- **Pre-Flight Diagnostic (`check_specguard.py`):** 7/7 suites PASSED (Python 64-bit, 16 runtime package imports, ML models, knowledge bases, 100% local frontend, bundled Windows Tesseract OCR, SQLite database I/O).
- **Offline Integrity:** Verified 0 outbound internet connections.
