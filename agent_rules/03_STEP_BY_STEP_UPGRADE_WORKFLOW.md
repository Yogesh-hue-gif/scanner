# Rule 03: Step-by-Step Environment Upgrade Workflow (SOP)

> **Objective:** Standard Operating Procedure (SOP) for successfully creating, upgrading, packing, and testing a Conda environment for an offline Windows machine.

---

## Prerequisites

- **Build Host:** A PC running **Windows 10 or 11 x64** with active internet access.
- **Conda Installation:** Anaconda or Miniconda installed (e.g. `C:\Users\<user>\miniconda3` or `anaconda3`).
- **Disk Space:** At least **15 GB free disk space** on the build host (for package caches, uncompressed env, and tarball).
- **Tooling:** Git, PowerShell, and access to the SpecGuard repository.

---

## Phase 1: Modify Package Specifications (Online Build Host)

### Step 1.1: Edit `environment.yml`
Open `environment.yml` and add or modify the dependency definitions.

```yaml
name: specguard
channels:
  - conda-forge
dependencies:
  - python=3.11
  # Core ASGI Web Stack
  - fastapi>=0.100.0,<1.0.0
  - uvicorn>=0.22.0,<1.0.0
  - python-multipart>=0.0.6
  - starlette
  # Document Parsers
  - pymupdf>=1.22.0
  - python-docx>=0.8.11
  - openpyxl>=3.1.0
  # Numerics & Data
  - numpy>=1.24.0
  - pandas>=2.0.0
  - pyyaml>=6.0
  - jinja2>=3.1.0
  # Vision (Self-contained OCR replacement)
  - opencv>=4.7.0
  # ML Inference (STRICTLY CPU ONLY)
  - pytorch-cpu>=2.0.0
  - onnx>=1.14.0
  - onnxruntime>=1.15.0
  - psutil
  # Packaging & Relocation (MANDATORY)
  - conda-pack>=0.8.0
```

> [!IMPORTANT]
> Always verify that `conda-pack` is explicitly included in the `dependencies` list!

---

## Phase 2: Create / Update the Environment (Online Build Host)

Open **Anaconda Prompt (x64)** or a standard Command Prompt with Conda activated:

```cmd
:: 1. Navigate to the project root
cd /d C:\path\to\SpecGuard-Offline-Conda

:: 2. Remove any previous test environment if doing a clean build
conda env remove -n specguard -y

:: 3. Create the updated environment from the YAML recipe
conda env create -f environment.yml

:: 4. Activate the newly created environment
conda activate specguard
```

If updating an existing environment without removing it:
```cmd
conda env update -n specguard -f environment.yml --prune
conda activate specguard
```

---

## Phase 3: In-Situ Verification Before Packing (Online Build Host)

Before packaging, verify that all native C/C++ libraries load and work within the active environment.

```cmd
:: Run SpecGuard's automated verifier against the active environment
python verify_environment.py
```

Expected output:
```
[PASS]  python-interpreter       3.11.x
[PASS]  import:fastapi           0.1xx.x - FastAPI ASGI Web Framework
[PASS]  import:uvicorn           0.3x.x - Uvicorn ASGI Web Server
[PASS]  import:fitz              1.28.0 - PyMuPDF Document Engine
[PASS]  import:cv2               4.x.x - OpenCV Computer Vision Engine
[PASS]  import:torch             2.x.x - PyTorch Inference Engine (HARD requirement)
[PASS]  import:onnxruntime       1.x.x - ONNX Runtime Inference Engine
[PASS]  native:opencv            cv2 4.x.x - Canny on 8x8 probe OK
[PASS]  native:pymupdf           pymupdf - render+text-extract on synthetic page OK
[PASS]  native:torch             torch 2.x.x - matmul on CPU OK (cuda=False)
[PASS]  native:onnxruntime       onnxruntime 1.x.x - providers: CPUExecutionProvider
[PASS]  assertion:no-pytesseract PASS: pytesseract not present
--------------------------------------------------------------------------------
Environment verification: PASS (0 fatal failures)
```

> [!CAUTION]
> If any native check fails or an import errors out, **STOP**. Do NOT proceed to Phase 4 until `verify_environment.py` returns exit code 0.

---

## Phase 4: Archive with `conda-pack` (Online Build Host)

Once verified, package the environment into the portable tarball.

```cmd
:: 1. Ensure target directory exists
if not exist "environment" mkdir "environment"

:: 2. Pack the environment (use --ignore-missing-files for safety)
conda pack -n specguard -o environment\specguard-conda.tar.gz --ignore-missing-files --force

:: 3. Verify tarball was generated
dir environment\specguard-conda.tar.gz
```

The resulting `specguard-conda.tar.gz` should be approximately 1.2 GB to 1.5 GB.

---

## Phase 5: Update Lockfiles and Integrity Manifests (Online Build Host)

To maintain compliance and auditability:

```cmd
:: 1. Dump package metadata
conda list -n specguard --json > pkgs.json
python -m pip list --format=json > pip.json

:: 2. Regenerate reproducibility lockfile
python make_lockfile.py

:: 3. Regenerate SHA-256 checksums
python make_checksums.py
```

Clean up temporary json files:
```cmd
del pkgs.json pip.json >nul 2>&1
```

---

## Phase 6: Deployment to the Offline Target Machine

Transfer `environment\specguard-conda.tar.gz` (and optionally the updated `SHA256SUMS.txt`) to the air-gapped system via authorized storage media (e.g. encrypted USB drive).

### On the Offline Target Machine:

1. **Stop the running application:**
   ```cmd
   call STOP_SPECguard.bat
   ```

2. **Wipe the old extracted environment (Cache Busting):**
   ```cmd
   :: You must delete the extracted folder so START_SPECguard.bat extracts the new archive
   rmdir /s /q environment\env
   ```
   *(Or run `call rules\scripts\refresh_offline_target.bat`)*

3. **Verify Archive Integrity:**
   ```cmd
   certutil -hashfile environment\specguard-conda.tar.gz SHA256
   ```
   Confirm the SHA-256 matches `SHA256SUMS.txt`.

4. **Run Pre-Flight Check:**
   ```cmd
   call CHECK_SPECguard.bat
   ```

5. **Start SpecGuard:**
   ```cmd
   call START_SPECguard.bat
   ```
   On first launch, it will automatically:
   - Extract `environment\specguard-conda.tar.gz` to `environment\env\`
   - Run `environment\env\Scripts\conda-unpack.exe` to relocate paths
   - Write `.unpacked`
   - Set environment variables (`PYTHONHOME`, `PYTHONPATH`, `PATH`)
   - Launch the server on `0.0.0.0:8765`
   - Execute a post-boot health probe
