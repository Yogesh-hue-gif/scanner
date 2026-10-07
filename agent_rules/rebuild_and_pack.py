#!/usr/bin/env python
"""
SpecGuard - Automated Offline Conda Environment Rebuilder & Verifier.

Cross-platform helper with strict host architecture validation.
Prevents common errors such as attempting to build a Windows deployment on macOS or Linux.
"""

import os
import platform
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def check_host_platform():
    system = platform.system()
    machine = platform.machine()
    print(f"[*] Detected Host Platform: {system} ({machine})")
    
    if system != "Windows":
        print("\n" + "=" * 78)
        print("  CRITICAL ARCHITECTURE WARNING")
        print("=" * 78)
        print(f"  You are running this script on {system} ({machine}).")
        print("  SpecGuard Offline Target is strictly Windows x64 (win-64).")
        print("")
        print("  Conda environments containing native C/C++ extensions (PyTorch,")
        print("  OpenCV, PyMuPDF, SQLite) CANNOT cross-compile between OS families.")
        print(f"  An environment packed on {system} WILL NOT EXECUTE on Windows.")
        print("")
        print("  ACTION REQUIRED:")
        print("  To build an upgrade that executes on an offline Windows machine,")
        print("  you MUST execute this build process on a Windows 10/11 x64 machine,")
        print("  a Windows VM, or a Windows CI/CD runner.")
        print("=" * 78 + "\n")
        return False
    return True


def run_command(cmd, desc):
    print(f"\n[*] {desc}...")
    print(f"    $ {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[FAIL] {desc} failed with exit code {res.returncode}")
        if res.stdout:
            print("STDOUT:\n" + res.stdout)
        if res.stderr:
            print("STDERR:\n" + res.stderr)
        return False
    print(f"[PASS] {desc} successful.")
    return True


def main():
    print("=" * 78)
    print(" SpecGuard Offline Conda Environment Build & Validation Orchestrator")
    print("=" * 78)

    is_windows = check_host_platform()
    if not is_windows:
        sys.exit(1)

    env_yml = ROOT / "environment.yml"
    if not env_yml.exists():
        print(f"[FAIL] Missing {env_yml}")
        sys.exit(1)

    # 1. Update conda env
    if not run_command(["conda", "env", "update", "-n", "specguard", "-f", str(env_yml), "--prune"],
                       "Updating Conda environment 'specguard'"):
        sys.exit(1)

    # 2. Check verify_environment.py inside the environment
    py_exe = ROOT / "environment" / "env" / "python.exe"
    # Or resolve from conda env list
    active_py = sys.executable

    verify_script = ROOT / "verify_environment.py"
    if not run_command(["conda", "run", "-n", "specguard", "python", str(verify_script)],
                       "Verifying native libraries inside 'specguard'"):
        print("[FAIL] verify_environment.py failed. Refusing to package broken runtime.")
        sys.exit(1)

    # 3. Pack with conda-pack
    tarball = ROOT / "environment" / "specguard-conda.tar.gz"
    tarball.parent.mkdir(parents=True, exist_ok=True)
    if not run_command(["conda", "pack", "-n", "specguard", "-o", str(tarball), "--ignore-missing-files", "--force"],
                       f"Archiving environment into {tarball}"):
        sys.exit(1)

    # 4. Checksums & lockfile
    print("[*] Updating lockfiles and hashes...")
    if (ROOT / "make_lockfile.py").exists():
        subprocess.run(["conda", "run", "-n", "specguard", "python", str(ROOT / "make_lockfile.py")], cwd=str(ROOT))
    if (ROOT / "make_checksums.py").exists():
        subprocess.run(["conda", "run", "-n", "specguard", "python", str(ROOT / "make_checksums.py")], cwd=str(ROOT))

    print("\n" + "=" * 78)
    print(" SUCCESS! Environment packed and validated successfully.")
    print(f" Target archive: {tarball}")
    print("=" * 78)


if __name__ == "__main__":
    main()
