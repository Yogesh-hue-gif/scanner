# SpecGuard — Windows x64 Conda Runtime & Dependency Audit

**Document Version:** 1.0.0  
**Target Platform:** Windows x64 (`win-64`)  
**Deployment Modality:** Offline Conda-Pack (`specguard-conda.tar.gz`)  
**Host Architecture Requirements:** x86_64 CPU (AVX2 recommended), 4GB+ RAM, Windows 10/11 or Windows Server 2016+  
**Internet Connectivity Requirement:** 0% (Fully air-gapped / air-gap LAN capable)  

---

## 1. Executive Summary

This document presents the complete runtime and dependency audit for the **SpecGuard** offline deployment package on **Windows x64**. The application is 100% self-contained:
- All Python binaries, C-extensions, native Windows Dynamic Link Libraries (`.dll`), and third-party modules are pre-compiled and packed into `specguard-conda.tar.gz`.
- Target machines do **not** require Anaconda, Miniconda, Python, pip, Node.js, npm, Docker, or internet connectivity.
- Unpacking and execution are orchestrated natively via `START_SPECguard.bat` and verified via `CHECK_SPECguard.bat`.

---

## 2. Python Runtime Environment

- **Python Implementation:** CPython
- **Version:** `3.11.16` (64-bit Windows PE executable)
- **Conda Channel:** `conda-forge`
- **Native C-Runtimes Included:**
  - `python311.dll`
  - `vcruntime140.dll` & `vcruntime140_1.dll` (Visual C++ 2015-2022 Redistributable)
  - `msvcp140.dll` & `msvcp140_atomic_wait.dll`
  - `ucrtbase.dll` (Universal C Runtime)
  - `vcamp140.dll` & `vccorlib140.dll`

---

## 3. Dependency Classification Matrix

Every dependency discovered across `specguard/`, `app.py`, `run_web.py`, `scripts/`, and `tests/` has been categorized below:

| Package | Version | Conda Package / Build | Classification | Purpose in SpecGuard |
|---|---|---|---|---|
| **Python** | 3.11.16 | `python=3.11.16=hb12b558_2_cpython` | REQUIRED RUNTIME | Core language interpreter |
| **FastAPI** | 0.141.1 | `fastapi=0.141.1=h76d476e_0` | REQUIRED RUNTIME | REST API router, OpenAPI schema, request validation |
| **Uvicorn** | 0.54.0 | `uvicorn=0.54.0=pyhe2676ad_0` | REQUIRED RUNTIME | High-performance ASGI web server |
| **Pydantic** | 2.13.5 | `pydantic=2.13.5=pyhcf101f3_0` | REQUIRED RUNTIME | Domain schema validation, models, serializations |
| **PyMuPDF** | 1.28.0 | `pymupdf=1.28.0=py311h5dfdfe8_0` | REQUIRED RUNTIME | PDF document rendering, text AST, bbox extraction (`_mupdf.pyd`, `mupdfcpp64.dll`) |
| **OpenCV** | 5.0.0 | `opencv=5.0.0=qt6_he7afa43_607` | REQUIRED RUNTIME | Computer vision, document image thresholding, morphological deskewing |
| **NumPy** | 2.4.6 | `numpy=2.4.6=py311h65cb7f3_0` | REQUIRED RUNTIME | Tensor manipulation, vector calculations, matrix operations |
| **Pandas** | 3.0.6 | `pandas=3.0.6=np2py311hd01f973_0` | REQUIRED RUNTIME | Tabular inspection data, benchmark reporting, structured analytics |
| **PyTorch** | 2.13.0 | `pytorch=2.13.0=cpu_mkl_py311_h51f520b_103` | REQUIRED RUNTIME | Neural network evaluation, BiLSTM entity extraction, cross-domain classification |
| **ONNX** | 1.23.0 | `onnx=1.23.0=py311h5618106_0` | REQUIRED RUNTIME | Model computation graph definitions and interchange |
| **ONNX Runtime** | 1.30.0 | `onnxruntime=1.30.0=py311hb3f71b7_1_cpu` | REQUIRED RUNTIME | Accelerated CPU neural inference without PyTorch overhead |
| **python-docx** | 1.2.0 | `python-docx=1.2.0=pyhff2d567_0` | REQUIRED RUNTIME | Native DOCX document parsing, XML structure and paragraph extraction |
| **openpyxl** | 3.1.5 | `openpyxl=3.1.5=py311h4d8bf61_4` | REQUIRED RUNTIME | Excel workbook parsing and table verification |
| **PyYAML** | 6.0.3 | `pyyaml=6.0.3=py311h3f79411_1` | REQUIRED RUNTIME | Parsing engineering rules, standards, and profile definitions |
| **psutil** | 7.2.2 | `psutil=7.2.2=py311hf893f09_3` | REQUIRED RUNTIME | Hardware resource monitoring (CPU, RAM, GPU diagnostics) |
| **Jinja2** | 3.1.6 | `jinja2=3.1.6=pyhcf101f3_1` | REQUIRED RUNTIME | HTML template compilation and report generation |
| **python-multipart** | 0.0.32 | `python-multipart=0.0.32=pyhcf101f3_0` | REQUIRED RUNTIME | Streaming multipart file uploads in FastAPI |
| **ReportLab** | 4.4.10 | `reportlab=4.4.10=py311h4d8bf61_0` | REQUIRED RUNTIME | Native PDF report generation (audit summary & compliance certificate) |
| **Pillow (PIL)** | 11.3.0 | `pillow=11.3.0=py311h25c1103_3` | REQUIRED RUNTIME | Image rasterization, canvas export, and icon generation |
| **SQLite3** | 3.49.1 | Built-in (`sqlite3.dll`) | REQUIRED RUNTIME | Persistent session storage, tolerance results, and document metadata |
| **conda-pack** | 0.9.2 | `conda-pack=0.9.2=pyhcf101f3_0` | PACKAGING ONLY | Portable environment archiving tool |
| **pytest** | 8.3.2 | Installed in dev | DEVELOPMENT/TEST | Unit and integration test runner |
| **pytest-asyncio**| 0.24.0 | Installed in dev | DEVELOPMENT/TEST | Async API testing fixture |
| **httpx** | 0.27.2 | Installed in dev | DEVELOPMENT/TEST | TestClient transport for FastAPI testing |
| **Docker** | N/A | Removed | OBSOLETE | Completely removed from architecture |
| **Render** | N/A | Removed | OBSOLETE | Cloud deployment config removed |

---

## 4. Native Windows DLL Audit

The packed environment includes all dynamic link libraries required for offline execution without installing external Microsoft Visual C++ redistributable packages:

1. **Core C/C++ Runtime:**
   - `vcruntime140.dll`
   - `vcruntime140_1.dll`
   - `msvcp140.dll`
   - `msvcp140_1.dll`
   - `msvcp140_2.dll`
   - `msvcp140_atomic_wait.dll`
   - `ucrtbase.dll`
2. **Intel MKL / OpenBLAS (Accelerated Math):**
   - `mkl_rt.dll` / `openblas.dll`
   - `libiomp5md.dll` (OpenMP Multithreading runtime)
3. **MuPDF Rendering Subsystem:**
   - `mupdfcpp64.dll`
   - `_mupdf.pyd`
4. **OpenCV Subsystem:**
   - `opencv_world*.dll`
   - Image decoder DLLs: `libjpeg.dll`, `libpng.dll`, `libtiff.dll`, `libwebp.dll`

---

## 5. Machine Learning Models Audit

All ML weights are stored locally inside `app/models/` and referenced in `MODEL_MANIFEST.json`:
- **DomainClassifierNet:** `models/checkpoints/domain_classifier.pt` (319,340 bytes) & `models/onnx/domain_classifier.onnx` (44,310 bytes).
- **LogicalRelationNet:** `models/checkpoints/logical_classifier.pt` (411,085 bytes) & `models/onnx/logical_classifier.onnx` (55,393 bytes).
- **EngineeringNERNet:** `models/checkpoints/engineering_ner.pt` (301,002 bytes).
- **Cross-Domain ONNX Graphs:** 115+ specialized domain models in `models/onnx/` and `models/cross_domain/`.
- **Zero-Download Guarantee:** Model loading uses local filesystem paths exclusively. If an optional model artifact is omitted, the engine automatically falls back to deterministic rule-based analysis without network calls.

---

## 6. OCR Subsystem Audit

SpecGuard incorporates a two-tier OCR strategy:
1. **Bundled Windows Tesseract Runtime:**
   - Executable: `runtime/tesseract/tesseract.exe` (v5.5.3, Windows x64)
   - Trained Data: `runtime/tesseract/tessdata/eng.traineddata` (3,980,480 bytes, sha256: `c4b1d...`)
   - Supporting DLLs: `leptonica-1.84.1.dll`, `libarchive.dll`, `libpng16.dll`, `zlib1.dll`, `libcurl.dll`
   - Configured via automatic detection in `specguard/core/runtime_paths.py` and `START_SPECguard.bat`.
2. **Morphological Computer Vision Fallback:**
   - If Tesseract is unavailable or disabled, SpecGuard's built-in OpenCV morphological engine performs optical line and bounding box detection natively in Python.

---

## 7. Packaging & Archive Creation

1. **Build Tool:** `conda-pack` v0.9.2 (or portable micromamba extraction targeting `--platform win-64`).
2. **Output Archive:** `SpecGuard-Offline-Conda/environment/specguard-conda.tar.gz`
3. **Archive Size:** ~1.2 GB compressed / ~3.8 GB uncompressed.
4. **Unpacking Method:** Built-in Windows 10/11 `tar.exe -xzf` (requires no third-party 7-Zip or WinRAR).
