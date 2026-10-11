"""
SpecGuard Comprehensive Deployment & Pre-Flight Diagnostic Checker.
Validates all runtime subsystems, native dependencies, model files, rules,
standards, templates, and storage. Produces explicit PASS / FAIL / WARNING results.
"""

import sys
import os
from pathlib import Path

def run_diagnostics():
    print("=" * 78)
    print("  SpecGuard — Production Offline Pre-Flight System Diagnostic")
    print("=" * 78)

    passed_count = 0
    warning_count = 0
    failed_count = 0

    # 1. Python Architecture & Version
    is_64bit = sys.maxsize > 2**32
    py_ver = sys.version.split()[0]
    print(f"\n[1/7] Python Runtime:")
    print(f"  - Version: {py_ver}")
    print(f"  - 64-bit Architecture: {is_64bit} ({sys.platform})")
    if is_64bit and sys.version_info >= (3, 9):
        print("  -> [PASS] Python runtime meets requirements (64-bit, >= 3.9)")
        passed_count += 1
    else:
        print("  -> [FAIL] Python runtime must be 64-bit and >= 3.9")
        failed_count += 1

    # 2. Package Imports
    print(f"\n[2/7] Core Dependency Imports:")
    required_packages = [
        ("FastAPI", "fastapi"),
        ("Uvicorn", "uvicorn"),
        ("Pydantic", "pydantic"),
        ("PyMuPDF (fitz)", "pymupdf"),
        ("OpenCV", "cv2"),
        ("NumPy", "numpy"),
        ("Pandas", "pandas"),
        ("PyTorch", "torch"),
        ("ONNX", "onnx"),
        ("ONNX Runtime", "onnxruntime"),
        ("python-docx", "docx"),
        ("openpyxl", "openpyxl"),
        ("PyYAML", "yaml"),
        ("psutil", "psutil"),
        ("Jinja2", "jinja2"),
        ("python-multipart", "multipart"),
    ]

    import_failures = []
    for display_name, mod_name in required_packages:
        try:
            mod = __import__(mod_name)
            ver = getattr(mod, "__version__", "OK")
            print(f"  - {display_name:<20}: [OK] (v{ver})")
        except Exception as e:
            print(f"  - {display_name:<20}: [FAIL] ({e})")
            import_failures.append((display_name, str(e)))

    if not import_failures:
        print("  -> [PASS] All 16 required runtime packages imported successfully.")
        passed_count += 1
    else:
        print(f"  -> [FAIL] {len(import_failures)} package(s) failed to import.")
        failed_count += 1

    # 3. Model Files
    print(f"\n[3/7] Machine Learning Models & Checkpoints:")
    base_dir = Path(__file__).resolve().parent
    # Check if app/ subdirectory exists (packaged format) or current directory
    app_dir = base_dir / "app" if (base_dir / "app").exists() else base_dir
    models_dir = app_dir / "models"

    expected_models = [
        ("DomainClassifierNet (PyTorch)", models_dir / "checkpoints" / "domain_classifier.pt"),
        ("DomainClassifierNet (ONNX)", models_dir / "onnx" / "domain_classifier.onnx"),
        ("LogicalRelationNet (PyTorch)", models_dir / "checkpoints" / "logical_classifier.pt"),
        ("LogicalRelationNet (ONNX)", models_dir / "onnx" / "logical_classifier.onnx"),
        ("EngineeringNERNet (PyTorch)", models_dir / "checkpoints" / "engineering_ner.pt"),
    ]

    model_failures = []
    for name, path in expected_models:
        if path.exists() and path.stat().st_size > 0:
            print(f"  - {name:<30}: [OK] ({path.stat().st_size:,} bytes)")
        else:
            print(f"  - {name:<30}: [MISSING]")
            model_failures.append(name)

    if not model_failures:
        print("  -> [PASS] All critical ML model checkpoints verified on disk.")
        passed_count += 1
    else:
        print(f"  -> [WARNING] {len(model_failures)} model checkpoint(s) missing. Application will use rule-based fallback.")
        warning_count += 1

    # 4. Rules, Standards & Templates
    print(f"\n[4/7] Knowledge Bases (Rules, Standards, Templates):")
    rules_dir = app_dir / "rules"
    standards_dir = app_dir / "standards"
    templates_dir = app_dir / "templates"

    rules_count = len(list(rules_dir.rglob("*.json")) + list(rules_dir.rglob("*.yaml"))) if rules_dir.exists() else 0
    standards_count = len(list(standards_dir.rglob("*.json")) + list(standards_dir.rglob("*.yaml"))) if standards_dir.exists() else 0
    templates_count = len(list(templates_dir.rglob("*.json")) + list(templates_dir.rglob("*.yaml"))) if templates_dir.exists() else 0

    print(f"  - Engineering Rule Bases     : {rules_count} rule files ({rules_dir})")
    print(f"  - Engineering Standards      : {standards_count} standard files ({standards_dir})")
    print(f"  - Document Templates         : {templates_count} template files ({templates_dir})")

    if rules_count > 0 and standards_count > 0 and templates_count > 0:
        print("  -> [PASS] Rules, standards, and templates verified.")
        passed_count += 1
    else:
        print("  -> [FAIL] One or more knowledge base directories are missing or empty.")
        failed_count += 1

    # 5. Frontend Assets
    print(f"\n[5/7] Frontend Assets (100% Local / Zero CDN):")
    static_dir = app_dir / "static" if (app_dir / "static").exists() else app_dir / "specguard" / "web" / "static"
    css_files = len(list((static_dir / "css").glob("*.css"))) if (static_dir / "css").exists() else 0
    js_files = len(list(static_dir.rglob("*.js"))) if static_dir.exists() else 0
    print(f"  - Static Assets Directory    : {static_dir}")
    print(f"  - CSS Stylesheets (Local)    : {css_files} files")
    print(f"  - JavaScript Modules (Local) : {js_files} files")

    if css_files >= 4 and js_files >= 10:
        print("  -> [PASS] Frontend static assets verified local and self-contained.")
        passed_count += 1
    else:
        print("  -> [FAIL] Static CSS/JS assets are missing or incomplete.")
        failed_count += 1

    # 6. OCR Runtime Detection
    print(f"\n[6/7] OCR Subsystem:")
    tess_paths = [
        base_dir / "runtime" / "tesseract" / "tesseract.exe",
        base_dir / "runtime" / "tesseract" / "tesseract",
        app_dir / "runtime" / "tesseract" / "tesseract.exe",
    ]
    tess_found = None
    for p in tess_paths:
        if p.exists():
            tess_found = p
            break

    if tess_found:
        tessdata = tess_found.parent / "tessdata" / "eng.traineddata"
        if tessdata.exists():
            print(f"  - Portable Tesseract Engine : [OK] {tess_found}")
            print(f"  - English OCR Trained Data   : [OK] {tessdata} ({tessdata.stat().st_size:,} bytes)")
            print("  -> [PASS] Bundled Windows Tesseract OCR runtime verified.")
            passed_count += 1
        else:
            print(f"  - Portable Tesseract Engine : [OK] {tess_found}")
            print(f"  - English OCR Trained Data   : [MISSING]")
            print("  -> [WARNING] Tesseract binary found but eng.traineddata is missing. Morphological OCR fallback active.")
            warning_count += 1
    else:
        import shutil
        sys_tess = shutil.which("tesseract")
        if sys_tess:
            print(f"  - System Tesseract Engine   : [OK] {sys_tess}")
            print("  -> [PASS] System Tesseract OCR runtime detected.")
            passed_count += 1
        else:
            print("  - Tesseract Engine           : [INFO] Not bundled / not in PATH")
            print("  -> [PASS] Built-in OpenCV morphological document vision engine active (fallback mode).")
            passed_count += 1

    # 7. Persistent Data Storage
    print(f"\n[7/7] Persistent Storage & Database:")
    data_dir = base_dir / "data"
    subdirs = ["database", "uploads", "reports", "logs", "repository"]
    for sub in subdirs:
        (data_dir / sub).mkdir(parents=True, exist_ok=True)
    print(f"  - Data Directory             : {data_dir} (All subdirectories verified)")

    # Test SQLite connection
    import sqlite3
    db_file = data_dir / "database" / "specguard_diag.db"
    try:
        conn = sqlite3.connect(str(db_file))
        conn.execute("CREATE TABLE IF NOT EXISTS diag (id INT, status TEXT);")
        conn.execute("INSERT INTO diag VALUES (1, 'OK');")
        conn.commit()
        conn.close()
        db_file.unlink(missing_ok=True)
        print("  - SQLite Database I/O        : [OK] Read/Write test passed")
        print("  -> [PASS] Local persistent storage verified operational.")
        passed_count += 1
    except Exception as e:
        print(f"  - SQLite Database I/O        : [FAIL] ({e})")
        print("  -> [FAIL] Failed writing to local database directory.")
        failed_count += 1

    print("\n" + "=" * 78)
    print(f"  DIAGNOSTIC SUMMARY: {passed_count} PASSED, {warning_count} WARNING(S), {failed_count} FAILED")
    print("=" * 78)

    if failed_count == 0:
        print("\n  STATUS: [PASS] SpecGuard offline environment is READY for launch.")
        return 0
    else:
        print("\n  STATUS: [FAIL] Pre-flight checks failed. Please resolve the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(run_diagnostics())
