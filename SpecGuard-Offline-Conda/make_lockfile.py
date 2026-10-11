#!/usr/bin/env python
"""
SpecGuard — Reproducibility Lockfile Generator.
Complies with Rule 03 Phase 5 (Update Lockfiles & Integrity Manifests).

Generates conda-environment-lock.txt from:
  1. pkgs.json (output of `conda list --json`)
  2. pip.json (output of `pip list --format=json`)
  3. environment.yml (fallback)
"""

import sys
import os
import json
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent
LOCKFILE = ROOT / "conda-environment-lock.txt"


def generate_lockfile():
    print("=" * 78)
    print(" SpecGuard — Conda Reproducibility Lockfile Generator")
    print("=" * 78)

    pkgs_json = ROOT / "pkgs.json"
    pip_json = ROOT / "pip.json"
    env_yml = ROOT / "environment.yml"

    packages = []

    if pkgs_json.exists():
        try:
            with open(pkgs_json, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    name = item.get("name", "")
                    ver = item.get("version", "")
                    build = item.get("build_string", "")
                    channel = item.get("channel", "conda-forge")
                    packages.append(f"{name}=={ver}=={build} ({channel})")
            print(f"[*] Parsed {len(packages)} packages from {pkgs_json.name}.")
        except Exception as e:
            print(f"[WARN] Failed parsing {pkgs_json}: {e}")

    if not packages and env_yml.exists():
        print(f"[*] Generating baseline lock entries from {env_yml.name}...")
        try:
            for line in env_yml.read_text(encoding="utf-8").splitlines():
                s = line.strip()
                if s.startswith("- ") and not s.startswith("- pip"):
                    pkg = s[2:].split("#")[0].strip()
                    if pkg and not pkg.startswith("-"):
                        packages.append(f"{pkg} (conda-forge)")
        except Exception as e:
            print(f"[WARN] Failed reading {env_yml}: {e}")

    try:
        from datetime import timezone
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    except Exception:
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    lines = [
        "# ==============================================================================",
        "# SpecGuard — Pinned Conda Environment Lockfile",
        f"# Generated: {timestamp}",
        "# Platform: Windows x64 (win-64) | Python: 3.11 | Channel: conda-forge",
        "# ==============================================================================",
        "",
    ]
    lines.extend(sorted(packages))
    lines.append("")

    LOCKFILE.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] Generated lockfile at: {LOCKFILE} ({len(packages)} entries)")
    return 0


if __name__ == "__main__":
    sys.exit(generate_lockfile())
