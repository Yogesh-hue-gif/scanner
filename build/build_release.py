"""
DocReady Automated Windows x64 Production Release Assembly Script.
Assembles the minimal production distribution directory: DocReady-Windows-x64/
Generates MANIFEST.sha256 and creates versioned release ZIP.
"""

import os
import shutil
import hashlib
import zipfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "DocReady-Windows-x64"
ZIP_OUTPUT = ROOT_DIR / "DocReady-v1.0.0-Windows-x64.zip"

EXCLUDE_PATTERNS = {
    "__pycache__", ".pytest_cache", ".ruff_cache", ".mypy_cache",
    ".git", ".gitignore", "*.pyc", "*.pyo", "*.log"
}


def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def copy_tree_clean(src: Path, dst: Path):
    """Copies directory recursively, omitting pycache and temporary caches."""
    if not dst.exists():
        dst.mkdir(parents=True)
    for item in src.iterdir():
        if item.name in EXCLUDE_PATTERNS or item.name.startswith("."):
            continue
        if item.is_dir():
            copy_tree_clean(item, dst / item.name)
        else:
            if not any(item.name.endswith(ext) for ext in [".pyc", ".pyo"]):
                shutil.copy2(item, dst / item.name)


def assemble_release():
    print("=" * 75)
    print("  ASSEMBLING DOCREADY WINDOWS x64 PRODUCTION RELEASE")
    print("=" * 75)

    if DIST_DIR.exists():
        print(f"[1/5] Cleaning existing release folder: {DIST_DIR.name}...")
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True)

    # 1. Copy Application Code & Static Web Assets
    print("[2/5] Copying application core packages and web UI...")
    copy_tree_clean(ROOT_DIR / "specguard", DIST_DIR / "specguard")
    copy_tree_clean(ROOT_DIR / "rules", DIST_DIR / "rules")
    copy_tree_clean(ROOT_DIR / "standards", DIST_DIR / "standards")
    copy_tree_clean(ROOT_DIR / "templates", DIST_DIR / "templates")
    copy_tree_clean(ROOT_DIR / "demo_samples", DIST_DIR / "demo_samples")

    # 2. Copy Root Scripts & Launchers
    print("[3/5] Copying launchers, configurations, and documentation...")
    root_files_to_copy = [
        "app.py",
        "run_web.py",
        "pyproject.toml",
        "MODEL_INVENTORY.json",
        "Launch_DocReady.bat",
        "Verify_Offline.bat",
        "README_OFFLINE.md",
        "LICENSE.txt"
    ]
    for rf in root_files_to_copy:
        src_path = ROOT_DIR / rf
        if src_path.exists():
            shutil.copy2(src_path, DIST_DIR / rf)
        else:
            print(f"  [WARNING] File {rf} not found at root.")

    # 3. Create Writable Data & Log Directories
    (DIST_DIR / "data" / "uploads").mkdir(parents=True, exist_ok=True)
    (DIST_DIR / "logs").mkdir(parents=True, exist_ok=True)

    # 4. Generate MANIFEST.sha256
    print("[4/5] Computing SHA-256 release checksums for all files...")
    manifest_entries = []
    total_files = 0
    total_bytes = 0

    for root, _, files in os.walk(DIST_DIR):
        for f in files:
            fp = Path(root) / f
            rel = fp.relative_to(DIST_DIR).as_posix()
            sha = compute_sha256(fp)
            size = fp.stat().st_size
            manifest_entries.append(f"{sha}  {rel}")
            total_files += 1
            total_bytes += size

    manifest_entries.sort()
    manifest_path = DIST_DIR / "MANIFEST.sha256"
    manifest_path.write_text("\n".join(manifest_entries) + "\n", encoding="utf-8")
    print(f"  [OK] Manifest created: {total_files} files ({total_bytes / (1024*1024):.2f} MB)")

    # 5. Create Standalone Release ZIP
    print(f"[5/5] Compressing production distribution into {ZIP_OUTPUT.name}...")
    with zipfile.ZipFile(ZIP_OUTPUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, _, files in os.walk(DIST_DIR):
            for f in files:
                fp = Path(root) / f
                arcname = Path("DocReady-Windows-x64") / fp.relative_to(DIST_DIR)
                zf.write(fp, arcname=str(arcname))

    zip_size_mb = ZIP_OUTPUT.stat().st_size / (1024 * 1024)
    print("=" * 75)
    print(f"  RELEASE ASSEMBLY COMPLETE!")
    print(f"  Directory: {DIST_DIR}")
    print(f"  Archive:   {ZIP_OUTPUT} ({zip_size_mb:.2f} MB)")
    print(f"  Files:     {total_files}")
    print("=" * 75)


if __name__ == "__main__":
    assemble_release()
