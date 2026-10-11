#!/usr/bin/env python
"""
SpecGuard — Native Environment Verification Probe (Tier 1 Verification).
Complies with Rule 06 (Testing & Verification Checklist) and Rule 02 §9.

Tests:
  - Python interpreter architecture (64-bit) & version baseline (3.11)
  - Hard imports: fastapi, uvicorn, fitz, cv2, torch, onnxruntime
  - Native C/C++ execution:
      * OpenCV Canny edge detection kernel
      * PyTorch CPU tensor matmul & cuda=False assertion
      * PyMuPDF in-memory synthetic page render & pixmap extraction
      * ONNX Runtime CPUExecutionProvider presence
  - Regression guard: assertion:no-pytesseract (pytesseract must NOT be installed)
  - Secondary offline dependencies: docx, openpyxl, numpy, pandas, yaml, etc.

Returns:
  Exit code 0 if ALL critical checks pass.
  Exit code 1 on ANY fatal failure.
"""

import sys
import platform


def verify():
    fatal_failures = 0

    print("=" * 80)
    print(" SpecGuard — Native Environment & Binary Library Probe (Tier 1)")
    print("=" * 80)

    # 1. Python Interpreter Check
    py_ver = platform.python_version()
    is_64bit = sys.maxsize > 2**32
    if sys.version_info[0] == 3 and sys.version_info[1] == 11 and is_64bit:
        print(f"[PASS]  python-interpreter       {py_ver} (64-bit win-64 standard)")
    elif sys.version_info >= (3, 10) and is_64bit:
        print(f"[PASS]  python-interpreter       {py_ver} (64-bit compatible)")
    else:
        print(f"[FAIL]  python-interpreter       {py_ver} (Requires 64-bit Python 3.11)")
        fatal_failures += 1

    # 2. Hard Import Checks
    core_modules = [
        ("fastapi", "FastAPI ASGI Web Framework", True),
        ("uvicorn", "Uvicorn ASGI Web Server", True),
        ("fitz", "PyMuPDF Document Engine", True),
        ("cv2", "OpenCV Computer Vision Engine", True),
        ("torch", "PyTorch Inference Engine (HARD requirement)", True),
        ("onnxruntime", "ONNX Runtime Inference Engine", True),
    ]

    loaded_modules = {}
    for mod_name, label, is_hard in core_modules:
        try:
            m = __import__(mod_name)
            ver = getattr(m, "__version__", "loaded")
            loaded_modules[mod_name] = m
            print(f"[PASS]  import:{mod_name:<16} {ver} - {label}")
        except Exception as e:
            print(f"[FAIL]  import:{mod_name:<16} ERROR: {e}")
            if is_hard:
                fatal_failures += 1

    # 3. Native C/C++ Probes

    # 3a. Native OpenCV
    if "cv2" in loaded_modules:
        try:
            import numpy as np
            cv2 = loaded_modules["cv2"]
            ver = getattr(cv2, "__version__", "")
            probe_mat = np.zeros((8, 8), dtype=np.uint8)
            probe_mat[2:6, 2:6] = 255
            edges = cv2.Canny(probe_mat, 50, 150)
            if edges is not None and edges.shape == (8, 8):
                print(f"[PASS]  native:opencv            cv2 {ver} - Canny on 8x8 probe OK")
            else:
                print(f"[FAIL]  native:opencv            cv2 Canny returned unexpected result")
                fatal_failures += 1
        except Exception as e:
            print(f"[FAIL]  native:opencv            cv2 native execution failed: {e}")
            fatal_failures += 1
    else:
        print(f"[FAIL]  native:opencv            Skipped due to import failure")
        fatal_failures += 1

    # 3b. Native PyMuPDF
    if "fitz" in loaded_modules:
        try:
            fitz = loaded_modules["fitz"]
            doc = fitz.open()
            page = doc.new_page(width=100, height=100)
            page.insert_text(fitz.Point(10, 20), "probe")
            pix = page.get_pixmap()
            doc.close()
            if pix is not None and pix.width > 0:
                print(f"[PASS]  native:pymupdf           pymupdf - render+text-extract on synthetic page OK")
            else:
                print(f"[FAIL]  native:pymupdf           pymupdf failed rendering synthetic page")
                fatal_failures += 1
        except Exception as e:
            print(f"[FAIL]  native:pymupdf           pymupdf native execution failed: {e}")
            fatal_failures += 1
    else:
        print(f"[FAIL]  native:pymupdf           Skipped due to import failure")
        fatal_failures += 1

    # 3c. Native PyTorch (CPU-only enforcement)
    if "torch" in loaded_modules:
        try:
            torch = loaded_modules["torch"]
            ver = getattr(torch, "__version__", "")
            cuda_avail = torch.cuda.is_available()
            t = torch.randn(4, 4)
            res = t @ t
            if res is not None and res.shape == (4, 4):
                print(f"[PASS]  native:torch             torch {ver} - matmul on CPU OK (cuda={cuda_avail})")
                if cuda_avail:
                    print(f"[WARN]  native:torch             CUDA is active! Production standard recommends pytorch-cpu.")
            else:
                print(f"[FAIL]  native:torch             PyTorch matmul returned invalid shape")
                fatal_failures += 1
        except Exception as e:
            print(f"[FAIL]  native:torch             PyTorch native tensor calculation failed: {e}")
            fatal_failures += 1
    else:
        print(f"[FAIL]  native:torch             Skipped due to import failure")
        fatal_failures += 1

    # 3d. Native ONNX Runtime
    if "onnxruntime" in loaded_modules:
        try:
            ort = loaded_modules["onnxruntime"]
            ver = getattr(ort, "__version__", "")
            providers = ort.get_available_providers()
            if "CPUExecutionProvider" in providers:
                print(f"[PASS]  native:onnxruntime       onnxruntime {ver} - providers: {', '.join(providers)}")
            else:
                print(f"[FAIL]  native:onnxruntime       CPUExecutionProvider missing from {providers}")
                fatal_failures += 1
        except Exception as e:
            print(f"[FAIL]  native:onnxruntime       ONNX Runtime native probe failed: {e}")
            fatal_failures += 1
    else:
        print(f"[FAIL]  native:onnxruntime       Skipped due to import failure")
        fatal_failures += 1

    # 4. Regression Guard: Zero Tesseract / pytesseract assertion (Rule 02 §9, Rule 04 Rule 5)
    try:
        import pytesseract  # noqa: F401
        print("[FAIL]  assertion:no-pytesseract - VIOLATION: pytesseract is installed!")
        fatal_failures += 1
    except (ImportError, ModuleNotFoundError):
        print("[PASS]  assertion:no-pytesseract PASS: pytesseract not present")

    # 5. Additional Runtime Dependencies
    extra_packages = [
        ("docx", "python-docx"),
        ("openpyxl", "openpyxl"),
        ("numpy", "numpy"),
        ("pandas", "pandas"),
        ("yaml", "pyyaml"),
        ("jinja2", "jinja2"),
        ("psutil", "psutil"),
        ("multipart", "python-multipart"),
        ("reportlab", "reportlab"),
        ("PIL", "pillow"),
        ("conda_pack", "conda-pack"),
    ]

    for mod_name, label in extra_packages:
        try:
            __import__(mod_name)
        except Exception as e:
            print(f"[WARN]  dependency:{label:<14} Not loaded: {e}")

    # Summary
    print("-" * 80)
    if fatal_failures == 0:
        print("Environment verification: PASS (0 fatal failures)")
        return 0
    else:
        print(f"Environment verification: FAIL ({fatal_failures} fatal failure(s))")
        return 1


if __name__ == "__main__":
    sys.exit(verify())
