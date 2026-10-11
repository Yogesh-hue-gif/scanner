# DOCREADY — AUDIT & CLEANUP MANIFEST
**Product:** DocReady — Offline Engineering Document Readiness Verification (v1.0 Windows x64 Offline Edition)  
**Date:** October 2026  
**Auditor:** Antigravity Engineering Agent  

---

## 1. Overview & Classification Strategy

To satisfy the separation between **Maintainable Application Development Repository** and **Minimal Production Conda-Pack Release**, every directory and file in the authoritative archive has been inventoried and classified into one of the following categories:

1. **RUNTIME_REQUIRED:** Core application logic, API services, local web UI, analysis engines, templates, rules, and model inventories necessary for running DocReady offline.
2. **BUILD_REQUIRED:** Packaging scripts, Windows launchers, environment definitions, and checksum generators for assembling the release.
3. **TEST_REQUIRED:** Automated regression test suites, mock document fixtures, and offline security verification scripts.
4. **DEV_ONLY:** Training datasets, benchmarking scripts, architecture guide source generators, and developer reference reports. (Retained in dev repo; excluded from production release).
5. **OBSOLETE_REMOVED:** Superfluous cloud/Docker/Render configurations and legacy deployment scripts incompatible with the air-gapped Windows Conda-Pack target.
6. **GENERATED_CACHE:** Python bytecode caches, temporary uploads, test caches, and OS metadata files.

---

## 2. File Inventory & Disposition Manifest

| Path | Category | Reason / Function | Disposition |
| :--- | :--- | :--- | :--- |
| `specguard/` | RUNTIME_REQUIRED | Core application packages (core, analyzers, storage, server, web, templates) | Retained (Active Runtime) |
| `specguard/web/static/js/views/home.js` | RUNTIME_REQUIRED | New DocReady professional homepage view | Added & Active |
| `rules/` | RUNTIME_REQUIRED | Local domain rules for ASME, IEC, IEEE, and Chemical P&ID | Retained |
| `standards/` | RUNTIME_REQUIRED | Engineering parameter validation baselines and tolerance profiles | Retained |
| `templates/` | RUNTIME_REQUIRED | Local document template definitions and clause schemas | Retained |
| `MODEL_INVENTORY.json` | RUNTIME_REQUIRED | Model weights manifest, checksums, CPU inference configurations | Retained |
| `app.py` | RUNTIME_REQUIRED | Primary application CLI / entry point | Retained |
| `run_web.py` | RUNTIME_REQUIRED | Local web server launcher (FastAPI / Uvicorn loopback binding) | Retained |
| `pyproject.toml` | RUNTIME_REQUIRED | Project metadata and dependency definitions | Retained |
| `Launch_DocReady.bat` | BUILD_REQUIRED | Windows one-click offline launcher (resolves paths, loopback health check) | Added & Active |
| `Verify_Offline.bat` | BUILD_REQUIRED | Automated offline health check and acceptance verification script | Added & Active |
| `build/environment.yml` | BUILD_REQUIRED | Pinned Windows x64 Conda environment specification | Added & Active |
| `build/build_release.py` | BUILD_REQUIRED | Automated packager assembling `DocReady-Windows-x64/` | Added & Active |
| `tests/` | TEST_REQUIRED | 143 automated regression tests (parsing, state, rules, security, reporting) | Retained in Dev Repo |
| `tests/test_pdf_parser_figures_regression.py` | TEST_REQUIRED | Phase 4 PDF background and vector diagram regression tests | Added & Active |
| `tests/test_upload_session_lifecycle_regression.py` | TEST_REQUIRED | Phase 5 upload validation and session lifecycle tests | Added & Active |
| `demo_samples/` | TEST_REQUIRED | Document fixtures for regression and demonstration tests | Retained |
| `SpecGuard-Dataset-v1/` | DEV_ONLY | Synthetic engineering document training dataset | Retained in Dev Repo only |
| `training/` | DEV_ONLY | Local model training utilities (kept distinct from inference runtime) | Retained in Dev Repo only |
| `benchmark.py` | DEV_ONLY | Performance and resource profiling harness | Retained in Dev Repo only |
| `benchmark_results/` | DEV_ONLY | Benchmark profiling outputs | Retained in Dev Repo only |
| `generate_guide_pdf.py` | DEV_ONLY | Documentation PDF compilation script | Retained in Dev Repo only |
| `Dockerfile` | OBSOLETE_REMOVED | Obsolete Docker container definition (superseded by Conda-Pack) | Verified unused; Removed |
| `.dockerignore` | OBSOLETE_REMOVED | Obsolete Docker ignore file | Verified unused; Removed |
| `docker-compose.yml` | OBSOLETE_REMOVED | Obsolete Docker compose file | Verified unused; Removed |
| `render.yaml` | OBSOLETE_REMOVED | Obsolete Render cloud deployment blueprint | Verified unused; Removed |
| `requirements-docker.txt` | OBSOLETE_REMOVED | Obsolete Docker-specific dependency list | Verified unused; Removed |
| `requirements-render.txt` | OBSOLETE_REMOVED | Obsolete cloud deployment dependency list | Verified unused; Removed |
| `__pycache__/` | GENERATED_CACHE | Python compiled bytecode caches | Cleared |
| `.pytest_cache/` | GENERATED_CACHE | Pytest execution caches | Cleared |

---

## 3. Verified Dependency Classification

### Production Runtime Dependencies (Pinned for Conda-Pack Windows x64):
- `python=3.11.16`
- `pymupdf=1.24.1` (or compatible 1.22+)
- `opencv-python-headless=4.10.0`
- `python-docx=1.1.2`
- `openpyxl=3.1.5`
- `numpy=1.26.4`
- `pandas=2.2.2`
- `pyyaml=6.0.2`
- `fastapi=0.115.0`
- `uvicorn=0.32.0`
- `python-multipart=0.0.12`
- `onnxruntime=1.19.2` (CPU optimized)
- `torch=2.4.1` (CPU build)

### Build & Packaging Dependencies:
- `conda-pack=0.7.1`

### Dev / Test Only Dependencies:
- `pytest=9.1.1`
- `pytest-cov=7.1.0`
- `httpx=0.28.1`
- `reportlab=4.2.5`
