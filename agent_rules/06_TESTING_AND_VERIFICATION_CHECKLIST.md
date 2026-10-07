# Rule 06: Testing & Verification Checklist

> **Scope:** Three-tier testing protocol required before shipping an upgraded offline environment package to production.

---

## The Three Testing Tiers

```
+---------------------------------------------------------------------------------+
| TIER 1: Native Environment Verification (verify_environment.py)                |
|   - Verifies interpreter version                                                |
|   - Tests all hard Python imports                                               |
|   - Executes native C/C++ calculations (OpenCV Canny, PyTorch matmul, PyMuPDF)  |
|   - Asserts zero Tesseract dependencies                                         |
+---------------------------------------------------------------------------------+
                                       |
                                       v
+---------------------------------------------------------------------------------+
| TIER 2: Pre-Flight Deployment Check (CHECK_SPECguard.bat)                       |
|   - Package structure & critical file presence                                  |
|   - Extraction state and conda-unpack status                                    |
|   - Data folder writability test                                                |
|   - Port 8765 availability probe                                                |
+---------------------------------------------------------------------------------+
                                       |
                                       v
+---------------------------------------------------------------------------------+
| TIER 3: Offline End-to-End Test (offline_e2e_test.py)                           |
|   - Boots server and checks HTTP /health endpoints                              |
|   - Validates UI HTML shell and local static CSS/JS (zero CDN)                  |
|   - Runs simulated PDF upload and document compliance inspection                |
|   - Verifies report export and SQLite database persistence                      |
+---------------------------------------------------------------------------------+
```

---

## Tier 1: Environment Verification (`verify_environment.py`)

Run this inside the active environment on the build host and on the target host:

```cmd
python verify_environment.py
```

### Critical Checks Performed
1. **`native:opencv`:** Executes a 2D Canny edge detection kernel on an 8x8 synthetic matrix. Proves that `libopencv`, OpenBLAS, and MSVC runtime loaded properly without missing symbol errors.
2. **`native:torch`:** Allocates 2D tensors and performs matrix multiplication (`t @ t`) on the CPU. Asserts that PyTorch's native C++ engine (`_C.pyd`) is functional.
3. **`native:pymupdf`:** Instantiates an in-memory PDF page, renders a text layer, and captures a synthetic raster pixmap. Proves MuPDF native libraries work.
4. **`native:onnxruntime`:** Probes available inference execution providers and asserts `CPUExecutionProvider` is active.
5. **`assertion:no-pytesseract`:** Validates that `pytesseract` is absent, strictly enforcing the zero-external-OCR policy.

**Success Criteria:** Must exit with code `0`. Any `[FAIL]` item is a packaging blocker.

---

## Tier 2: Pre-Flight Check (`CHECK_SPECguard.bat`)

Run this before starting the application:

```cmd
call CHECK_SPECguard.bat
```

### Expected Output Summary
```
==========================================================
  SpecGuard - Offline Deployment Pre-Flight Check
==========================================================

1. PACKAGE STRUCTURE
  [PASS] Application entry point (app\app.py)
  [PASS] Packed environment archive (environment\specguard-conda.tar.gz)
  [PASS] START_SPECguard.bat
  [PASS] STOP_SPECguard.bat
  [PASS] CHECK_SPECguard.bat

2. ENVIRONMENT
  [PASS] Extracted environment present
  [PASS] conda-unpack already completed
  [PASS] Environment python.exe executes

5. DATA DIRECTORY (writable)
  [PASS] data\ is writable

6. PORT 8765 AVAILABILITY
  [PASS] Port 8765 is available

7. RUNTIME IMPORT VERIFICATION
  [PASS] All core application modules import successfully

Pre-flight status: READY FOR STARTUP
```

---

## Tier 3: Offline End-to-End Integration Test (`offline_e2e_test.py`)

With the server running on `http://127.0.0.1:8765`:

```cmd
"%ROOT%\environment\env\python.exe" offline_e2e_test.py
```

### Full Verification Checklist

| Test Item | Verification Method | Expected Result | Checked? |
|---|---|---|:---:|
| Build Host OS | `systeminfo` | Windows 10/11 x64 (`win-64`) | [ ] |
| Python Version | `python --version` | Python 3.11.x | [ ] |
| conda-pack included | `conda list conda-pack` | Present in environment | [ ] |
| CPU PyTorch | `python -c "import torch; print(torch.cuda.is_available())"` | `False` | [ ] |
| Zero Tesseract | `python -c "import pytesseract"` | `ModuleNotFoundError` | [ ] |
| Native libraries | `python verify_environment.py` | Exit code 0 | [ ] |
| Packed archive size | `dir environment\specguard-conda.tar.gz` | Between 1.1 GB and 1.6 GB | [ ] |
| Target cache purged | Target `environment\env` deleted before run | Clean extraction | [ ] |
| Pre-flight check | `CHECK_SPECguard.bat` | ALL PASS | [ ] |
| Server launch | `START_SPECguard.bat` | Bound to 0.0.0.0:8765 | [ ] |
| Browser verification | Navigate to `http://localhost:8765` | UI loads completely | [ ] |
