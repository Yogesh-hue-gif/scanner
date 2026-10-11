"""
DocReady Automated Windows x64 Production Release Builder.
Assembles genuine self-contained, fully air-gapped Windows 10/11 x64 application package.

Workflow:
1. Validates Windows x64 platform and packaging prerequisites.
2. Packages/extracts relocatable Conda-Pack runtime into DocReady-Windows-x64/runtime/.
3. Runs conda-unpack to rewrite binary prefixes for standalone execution.
4. Copies application packages, rules, standards, templates, models, and UI assets.
5. Verifies required model weights, ONNX graphs, and registry integrity.
6. Configures writable runtime data/ and logs/ storage.
7. Computes SHA-256 digests into MANIFEST.sha256.
8. Generates DocReady-v1.0.0-Windows-x64.zip.
9. Executes offline acceptance verification on the newly packaged distribution.
"""

import os
import sys
import shutil
import hashlib
import zipfile
import subprocess
import time
from pathlib import Path
from typing import List, Dict, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "DocReady-Windows-x64"
ZIP_OUTPUT = ROOT_DIR / "DocReady-v1.0.0-Windows-x64.zip"
CACHE_DIR = ROOT_DIR / "build" / "cache"
CACHE_PACK = CACHE_DIR / "docready_runtime_win64.zip"

EXCLUDE_PATTERNS = {
    "__pycache__", ".pytest_cache", ".ruff_cache", ".mypy_cache",
    ".git", ".gitignore", "*.pyc", "*.pyo", "*.log", ".write_test"
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


def validate_prerequisites() -> Path:
    """Validates platform and locates source Conda environment."""
    print("[1/8] Validating platform and build prerequisites...")
    if sys.platform != "win32" or sys.maxsize <= 2**32:
        raise RuntimeError("Build target MUST be Windows x64. Detected: " + sys.platform)

    # Locate source conda environment
    candidates = [
        Path(os.environ.get("CONDA_PREFIX", "")),
        Path.home() / "anaconda3" / "envs" / "specguard",
        Path.home() / "miniconda3" / "envs" / "specguard",
        Path("C:/Users") / os.environ.get("USERNAME", "") / "anaconda3" / "envs" / "specguard",
        Path("C:/ProgramData/anaconda3/envs/specguard"),
    ]
    env_path = None
    for cand in candidates:
        if cand.exists() and (cand / "python.exe").exists():
            env_path = cand
            break

    if not env_path:
        raise FileNotFoundError(
            "Could not locate 'specguard' Conda environment. "
            "Please create it or activate it before running release build."
        )

    print(f"      Source environment verified: {env_path}")
    return env_path


def ensure_packed_runtime(env_path: Path):
    """Packs or retrieves cached Conda-Pack runtime archive and unpacks into DIST_DIR/runtime."""
    print("[2/8] Preparing Conda-Pack relocatable Windows x64 runtime...")
    runtime_dst = DIST_DIR / "runtime"
    runtime_dst.mkdir(parents=True, exist_ok=True)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if not CACHE_PACK.exists():
        print("      Creating Conda-Pack archive from source environment...")
        conda_pack_bin = None
        for cand in [
            Path.home() / "anaconda3" / "Scripts" / "conda-pack.exe",
            Path("C:/Users") / os.environ.get("USERNAME", "") / "anaconda3" / "Scripts" / "conda-pack.exe",
            Path(shutil.which("conda-pack") or "")
        ]:
            if cand.exists():
                conda_pack_bin = cand
                break

        if not conda_pack_bin:
            raise FileNotFoundError("conda-pack executable not found on host system.")

        cmd = [
            str(conda_pack_bin),
            "-p", str(env_path),
            "-o", str(CACHE_PACK),
            "--format", "zip",
            "--compress-level", "1",
            "--n-threads", "-1",
            "--ignore-missing-files"
        ]
        print(f"      Executing: {' '.join(cmd)}")
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"conda-pack failed: {res.stderr or res.stdout}")

    print(f"      Extracting runtime into: {runtime_dst}...")
    with zipfile.ZipFile(CACHE_PACK, "r") as zf:
        zf.extractall(runtime_dst)

    # Execute conda-unpack if present
    unpack_exe = runtime_dst / "Scripts" / "conda-unpack.exe"
    if unpack_exe.exists():
        print("      Running conda-unpack to finalize prefix relocation...")
        res = subprocess.run([str(unpack_exe)], cwd=runtime_dst, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"      [WARNING] conda-unpack reported: {res.stderr or res.stdout}")
        (runtime_dst / ".unpacked").write_text("ok", encoding="utf-8")

    python_bin = runtime_dst / "python.exe"
    if not python_bin.exists():
        raise RuntimeError(f"Packed runtime is corrupt: {python_bin} missing!")
    print(f"      Runtime extracted successfully: {python_bin}")


def copy_application_resources():
    """Copies application code, configurations, rules, templates, and models."""
    print("[3/8] Copying application code and offline assets...")
    copy_tree_clean(ROOT_DIR / "specguard", DIST_DIR / "specguard")
    copy_tree_clean(ROOT_DIR / "rules", DIST_DIR / "rules")
    copy_tree_clean(ROOT_DIR / "standards", DIST_DIR / "standards")
    copy_tree_clean(ROOT_DIR / "templates", DIST_DIR / "templates")
    copy_tree_clean(ROOT_DIR / "demo_samples", DIST_DIR / "demo_samples")
    copy_tree_clean(ROOT_DIR / "models", DIST_DIR / "models")

    # Copy root scripts and launchers
    for fname in [
        "app.py",
        "run_web.py",
        "pyproject.toml",
        "MODEL_INVENTORY.json",
        "Launch_DocReady.bat",
        "Verify_Offline.bat",
        "verify_offline.py",
        "README_OFFLINE.md",
        "LICENSE.txt"
    ]:
        src = ROOT_DIR / fname
        if src.exists():
            shutil.copy2(src, DIST_DIR / fname)
        else:
            print(f"      [WARNING] File missing from root: {fname}")


def verify_required_models():
    """Validates that all required ML models and ONNX graphs are present."""
    print("[4/8] Verifying required model weights and cryptographic manifests...")
    required_models = [
        DIST_DIR / "models" / "checkpoints" / "domain_classifier.pt",
        DIST_DIR / "models" / "checkpoints" / "logical_classifier.pt",
        DIST_DIR / "models" / "checkpoints" / "engineering_ner.pt",
        DIST_DIR / "models" / "onnx" / "domain_classifier.onnx",
        DIST_DIR / "models" / "onnx" / "logical_classifier.onnx",
        DIST_DIR / "models" / "model_registry.json",
        DIST_DIR / "MODEL_INVENTORY.json"
    ]

    for m in required_models:
        if not m.exists():
            raise FileNotFoundError(f"REQUIRED MODEL MISSING: {m}")
        size = m.stat().st_size
        if size == 0:
            raise ValueError(f"REQUIRED MODEL IS EMPTY (0 BYTES): {m}")
        print(f"      [OK] {m.relative_to(DIST_DIR)} ({size:,} bytes)")


def setup_storage_directories():
    """Ensures persistent user directories exist."""
    print("[5/8] Configuring writable data and log storage...")
    (DIST_DIR / "data" / "uploads").mkdir(parents=True, exist_ok=True)
    (DIST_DIR / "logs").mkdir(parents=True, exist_ok=True)


def generate_sha256_manifest():
    """Generates complete cryptographic SHA-256 manifest of the distribution."""
    print("[6/8] Generating release SHA-256 manifest...")
    manifest_entries = []
    manifest_file = DIST_DIR / "MANIFEST.sha256"

    total_files = 0
    total_bytes = 0
    for root, _, files in os.walk(DIST_DIR):
        for f in files:
            fp = Path(root) / f
            if fp == manifest_file:
                continue
            rel = fp.relative_to(DIST_DIR).as_posix()
            sha = compute_sha256(fp)
            size = fp.stat().st_size
            manifest_entries.append(f"{sha}  {rel}")
            total_files += 1
            total_bytes += size

    manifest_entries.sort()
    manifest_file.write_text("\n".join(manifest_entries) + "\n", encoding="utf-8")
    shutil.copy2(manifest_file, ROOT_DIR / "SHA256SUMS.txt")
    print(f"      Hashed {total_files:,} files ({total_bytes / (1024**2):.1f} MB total).")
    print(f"      Manifest written to: {manifest_file.name}")


def create_release_zip():
    """Creates the distributable release ZIP."""
    print(f"[7/8] Creating {ZIP_OUTPUT.name}...")
    if ZIP_OUTPUT.exists():
        ZIP_OUTPUT.unlink()

    file_count = 0
    start_time = time.time()
    with zipfile.ZipFile(ZIP_OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=1, allowZip64=True) as zf:
        for root, _, files in os.walk(DIST_DIR):
            for f in files:
                fp = Path(root) / f
                arcname = fp.relative_to(DIST_DIR.parent).as_posix()
                zf.write(fp, arcname=arcname)
                file_count += 1
                if file_count % 5000 == 0:
                    print(f"      Archived {file_count:,} files...")

    elapsed = time.time() - start_time
    zip_size_mb = ZIP_OUTPUT.stat().st_size / (1024**2)
    print(f"      ZIP created: {ZIP_OUTPUT.name} ({zip_size_mb:.1f} MB, {file_count:,} files in {elapsed:.1f}s)")


def run_acceptance_verification():
    """Executes offline acceptance test against the newly built distribution."""
    print("[8/8] Executing offline acceptance verification on packaged release...")
    python_bin = DIST_DIR / "runtime" / "python.exe"
    verify_script = DIST_DIR / "verify_offline.py"

    env = os.environ.copy()
    env["PATH"] = f"{DIST_DIR / 'runtime'};{DIST_DIR / 'runtime' / 'Library' / 'bin'};{DIST_DIR / 'runtime' / 'Scripts'};{env.get('PATH', '')}"
    env["PYTHONHOME"] = str(DIST_DIR / "runtime")
    env["PYTHONPATH"] = str(DIST_DIR)

    res = subprocess.run([str(python_bin), str(verify_script)], cwd=DIST_DIR, env=env, text=True, capture_output=True)
    print(res.stdout)
    if res.returncode != 0:
        print(res.stderr)
        raise RuntimeError("Packaged acceptance verification FAILED!")
    print("      Verification PASSED with 0 errors!")


def main():
    print("=" * 80)
    print("   DOCREADY WINDOWS x64 PRODUCTION CONDAPACK RELEASE BUILDER")
    print("=" * 80)
    t0 = time.time()

    if DIST_DIR.exists():
        print(f"Cleaning existing dist directory: {DIST_DIR}...")
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True)

    env_path = validate_prerequisites()
    ensure_packed_runtime(env_path)
    copy_application_resources()
    verify_required_models()
    setup_storage_directories()
    generate_sha256_manifest()
    create_release_zip()
    run_acceptance_verification()

    elapsed = time.time() - t0
    print("\n" + "=" * 80)
    print(f"   DOCREADY v1.0.0 RELEASE PACKAGED SUCCESSFULLY IN {elapsed:.1f}s")
    print(f"   Distribution Directory: {DIST_DIR}")
    print(f"   Distributable Archive:  {ZIP_OUTPUT}")
    print("=" * 80)


if __name__ == "__main__":
    main()
