# SpecGuard Offline Conda Environment Rules — Master Index & Quickstart

> **Status:** Production Standard for SpecGuard Air-Gapped Deployments  
> **Target OS:** Windows 10/11 x64 (`win-64`)  
> **Python Baseline:** Python 3.11 (`cp311`)  
> **Packaging Engine:** `conda-pack`  

---

## Executive Summary: Why Offline Environments Fail

If you attempted to create an `environment.yml` and run it or deploy it to an offline machine, it almost certainly failed for one of these fundamental architectural reasons:

1. **Attempting `conda env create` on the Offline Machine:**
   An air-gapped machine has no access to `conda-forge` or PyPI. An `environment.yml` file is **not an offline installer**; it is only a package recipe. You **cannot** execute `conda env create -f environment.yml` on an offline system.
2. **Platform & ABI Mismatch (e.g. Mac / Linux vs Windows):**
   Conda packages with C/C++ extensions (`torch`, `cv2`, `fitz`, `numpy`, `onnxruntime`) contain compiled native binaries (`.dll` vs `.so` vs `.dylib`). An environment created or packed on macOS or Linux **will never run on Windows**. Building must occur on a Windows x64 build host.
3. **Missing `conda-pack` Prefix Relocation:**
   Conda hardcodes absolute paths (`C:\Users\...\anaconda3\envs\...`) into script shebangs and binaries. Simply copying a Conda directory causes immediate crashes. An environment must be packaged with `conda-pack` and relocated on the target machine with `conda-unpack.exe`.
4. **Stale Extracted Environment Cache on the Offline Target:**
   `START_SPECguard.bat` checks if `environment\env\python.exe` already exists. If you drop a new `specguard-conda.tar.gz` into `environment\` without deleting `environment\env\`, the launcher will **skip extraction** and continue running the old environment!
5. **Missing `conda-pack` inside the Environment:**
   If `conda-pack` is not installed in the active environment on the build host, `conda-unpack.exe` will not be bundled. Without `conda-unpack.exe`, the relocation script fails during extraction.
6. **CUDA/GPU Dependency Leakage:**
   Unpinned `pytorch` pulls gigabytes of NVIDIA CUDA drivers and external DLLs that crash on offline non-GPU systems. You must strictly pin `pytorch-cpu`.

---

## Rules Directory Map

| Document | Topic & Focus |
|---|---|
| [01_ARCHITECTURE_AND_CONDA_PACK_MECHANICS.md](01_ARCHITECTURE_AND_CONDA_PACK_MECHANICS.md) | How the dual-host system works: Online Build Host vs Offline Air-Gapped Target, `conda-pack` internal mechanics, prefix rewriting. |
| [02_WHY_OFFLINE_ENVIRONMENTS_FAIL.md](02_WHY_OFFLINE_ENVIRONMENTS_FAIL.md) | Exhaustive root-cause breakdown of all 8 common failure modes with exact error messages and fixes. |
| [03_STEP_BY_STEP_UPGRADE_WORKFLOW.md](03_STEP_BY_STEP_UPGRADE_WORKFLOW.md) | The standard operating procedure (SOP) to upgrade packages, re-build, pack, test, and ship. |
| [04_ENVIRONMENT_SPECIFICATION_STANDARDS.md](04_ENVIRONMENT_SPECIFICATION_STANDARDS.md) | Standards for writing `environment.yml` and `requirements-conda.txt`, channel pinning, version locks, CPU pins. |
| [05_OFFLINE_DEPLOYMENT_AND_REFRESH_RULES.md](05_OFFLINE_DEPLOYMENT_AND_REFRESH_RULES.md) | Instructions for the offline machine: cache busting, extraction, `.unpacked` marker, path variables. |
| [06_TESTING_AND_VERIFICATION_CHECKLIST.md](06_TESTING_AND_VERIFICATION_CHECKLIST.md) | Pre-flight verification using `verify_environment.py`, native library probes, and `CHECK_SPECguard.bat`. |

---

## The 5 Golden Rules of SpecGuard Offline Conda Upgrades

```
+-----------------------------------------------------------------------------------+
| 1. ALWAYS BUILD ON THE SAME TARGET PLATFORM (Windows x64 for Windows x64).        |
| 2. NEVER RUN 'conda env create' ON AN AIR-GAPPED MACHINE (Only transfer archives).|
| 3. ALWAYS INCLUDE 'conda-pack' IN THE CONDA RECIPE (Provides conda-unpack.exe).  |
| 4. ALWAYS WIPE 'environment\env\' WHEN DEPLOYING A NEW TARBALL TO THE TARGET.      |
| 5. ALWAYS RUN 'verify_environment.py' BEFORE PACKING AND AFTER EXTRACTION.        |
+-----------------------------------------------------------------------------------+
```

---

## 30-Second Quickstart Workflow

When you need to upgrade packages or add new dependencies:

### On the Online Windows Build Machine:
```cmd
:: 1. Edit environment.yml with your desired package changes
notepad environment.yml

:: 2. Run the automated rebuild script
call rules\scripts\rebuild_and_pack.bat
```
This script will:
- Re-create/update the `specguard` Conda environment
- Validate all native imports (`torch`, `cv2`, `fitz`, etc.)
- Verify zero Tesseract regressions
- Bundle `conda-unpack.exe`
- Pack the environment into `environment\specguard-conda.tar.gz`
- Update lockfiles (`conda-environment-lock.txt`) and checksums (`SHA256SUMS.txt`)

### On the Offline Target Machine:
```cmd
:: 1. Copy the updated environment\specguard-conda.tar.gz to the offline machine
:: 2. Run the refresh helper to purge old cached env and unpack new runtime:
call rules\scripts\refresh_offline_target.bat

:: 3. Launch the application:
call START_SPECguard.bat
```
