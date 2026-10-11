#!/usr/bin/env python
"""
SpecGuard — SHA-256 Cryptographic Checksum Generator.
Complies with Rule 03 Phase 5 (Update Lockfiles & Integrity Manifests) and Rule 01 §4.

Generates SHA256SUMS.txt containing hashes for all critical package files.
"""

import sys
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SUMS_FILE = ROOT / "SHA256SUMS.txt"

# Target files relative to ROOT
TARGET_FILES = [
    "environment/specguard-conda.tar.gz",
    "environment.yml",
    "requirements-conda.txt",
    "MODEL_MANIFEST.json",
    "START_SPECguard.bat",
    "STOP_SPECguard.bat",
    "CHECK_SPECguard.bat",
    "check_specguard.py",
    "verify_environment.py",
    "offline_e2e_test.py",
    "make_lockfile.py",
    "make_checksums.py",
    "rules/00_INDEX_AND_QUICKSTART.md",
    "rules/01_ARCHITECTURE_AND_CONDA_PACK_MECHANICS.md",
    "rules/02_WHY_OFFLINE_ENVIRONMENTS_FAIL.md",
    "rules/03_STEP_BY_STEP_UPGRADE_WORKFLOW.md",
    "rules/04_ENVIRONMENT_SPECIFICATION_STANDARDS.md",
    "rules/05_OFFLINE_DEPLOYMENT_AND_REFRESH_RULES.md",
    "rules/06_TESTING_AND_VERIFICATION_CHECKLIST.md",
    "rules/scripts/rebuild_and_pack.bat",
    "rules/scripts/rebuild_and_pack.py",
    "rules/scripts/refresh_offline_target.bat",
    "runtime/tesseract/tesseract.exe",
    "runtime/tesseract/tessdata/eng.traineddata",
    "WINDOWS_OFFLINE_DEPLOYMENT.md",
    "CONDA_RUNTIME_AUDIT.md",
    "CLEANUP_REPORT.md",
    "README.txt",
]


def sha256_file(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(1024 * 1024 * 8):  # 8 MB chunks
            h.update(chunk)
    return h.hexdigest()


def generate_checksums():
    print("=" * 78)
    print(" SpecGuard — Cryptographic SHA-256 Checksum Manifest Generator")
    print("=" * 78)

    entries = []
    for rel_path in TARGET_FILES:
        target = ROOT / rel_path
        if target.exists() and target.is_file():
            print(f"[*] Hashing: {rel_path}...", end="", flush=True)
            try:
                digest = sha256_file(target)
                # Formatted in standard sha256sum format: <hash>  <relative_path_unix_style>
                clean_rel = rel_path.replace("\\", "/")
                entries.append(f"{digest}  {clean_rel}")
                print(f" [OK] ({digest[:12]}...)")
            except Exception as e:
                print(f" [ERROR: {e}]")
        else:
            print(f"[-] Skipped (not found): {rel_path}")

    # Write manifest
    content = "\n".join(entries) + "\n"
    SUMS_FILE.write_text(content, encoding="utf-8")
    print("=" * 78)
    print(f"[OK] SHA256SUMS.txt successfully updated with {len(entries)} entries at:")
    print(f"     {SUMS_FILE}")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(generate_checksums())
