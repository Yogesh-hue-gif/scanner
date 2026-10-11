# Rule 04: Environment Specification & Dependency Standards

> **Scope:** Rules for editing `environment.yml`, `requirements-conda.txt`, and declaring new packages for SpecGuard offline builds.

---

## 1. Golden Rules of Dependency Specification

### Rule 1: Single Channel Priority (`conda-forge`)
All Conda packages must be resolved exclusively from `conda-forge`. Do not mix `defaults` or `anaconda` channels, as mixing channels on Windows causes binary DLL symbol collisions (e.g. mismatched OpenSSL or MSVCRT runtimes).

```yaml
channels:
  - conda-forge
  - nodefaults
```

---

### Rule 2: Strict Python 3.11 Interpreter Pin
Never declare unpinned `python` or bump to `python=3.12` or `python=3.14`.
```yaml
dependencies:
  - python=3.11  # MANDATORY: Validated ABI baseline
```
**Rationale:** SpecGuard's production pipeline uses native compiled extensions (`PyMuPDF/fitz`, `torch-cpu`, `onnxruntime`, `cv2`). Python 3.11 has pre-compiled, stable wheels for all components on `win-64`.

---

### Rule 3: Strictly CPU-Only ML Inference
Never list `pytorch` or `torch` without specifying `pytorch-cpu`.
```yaml
# CORRECT:
  - pytorch-cpu>=2.0.0
  - onnxruntime>=1.15.0

# FORBIDDEN:
  - pytorch           # Pulls 2.5 GB of NVIDIA CUDA runtimes
  - onnxruntime-gpu   # Fails when NVIDIA drivers are absent
```
**Rationale:** The offline environment runs on standard engineering workstation PCs without dedicated GPUs. Adding CUDA runtimes increases package size by 3+ GB and causes DLL load errors when CUDA drivers are not present on the host.

---

### Rule 4: Mandatory Inclusion of `conda-pack`
Always include `conda-pack` in the YAML recipe:
```yaml
dependencies:
  - conda-pack>=0.8.0
```
**Rationale:** Without `conda-pack` inside the environment, the build host cannot produce `%ENV_DIR%\Scripts\conda-unpack.exe`. Without `conda-unpack.exe`, prefix relocation on the offline target machine fails.

---

### Rule 5: Zero Tesseract / pytesseract Rule
Under no circumstances should `pytesseract` or `tesseract` be added to dependencies.
```yaml
# FORBIDDEN:
  - pytesseract
  - tesseract
```
**Rationale:** SpecGuard's vision engine uses a 100% self-contained OpenCV morphological layout analyzer. `verify_environment.py` includes a regression check that fails if `pytesseract` is importable.

---

### Rule 6: No Cloud SDKs or Remote Services
Do not introduce packages requiring internet endpoints:
- **Forbidden:** `openai`, `google-genai`, `anthropic`, `boto3`, `azure-storage`, `huggingface_hub`.
- If an NLP model is added, it must operate via local ONNX runtime fallback or bundled weights.

---

## 2. Complete Reference `environment.yml` Template

```yaml
# ==============================================================================
# SpecGuard — Offline Conda-Pack Deployment Environment Template
# Target: Windows x64 (win-64) | Python 3.11 | Channel: conda-forge
# ==============================================================================
name: specguard

channels:
  - conda-forge
  - nodefaults

dependencies:
  # --- Core interpreter ---
  - python=3.11

  # --- Relocation & Packaging Tooling (MANDATORY) ---
  - conda-pack>=0.8.0

  # --- ASGI Web Framework & Server ---
  - fastapi>=0.100.0,<1.0.0
  - uvicorn>=0.22.0,<1.0.0
  - python-multipart>=0.0.6
  - starlette

  # --- Self-Contained Document Parsers ---
  - pymupdf>=1.22.0
  - python-docx>=0.8.11
  - openpyxl>=3.1.0

  # --- Numerics & Structured Data ---
  - numpy>=1.24.0
  - pandas>=2.0.0
  - pyyaml>=6.0
  - jinja2>=3.1.0

  # --- Computer Vision & Built-in OCR ---
  - opencv>=4.7.0

  # --- Offline ML Inference (CPU-Only) ---
  - pytorch-cpu>=2.0.0
  - onnx>=1.14.0
  - onnxruntime>=1.15.0

  # --- Diagnostics & Telemetry ---
  - psutil
```
