# Rule 02: Why Offline Conda Environments Fail (Failure Modes & Solutions)

> **Purpose:** Detailed diagnostic guide explaining why new environment files fail to execute on air-gapped systems, with exact symptoms, root causes, and verified solutions.

---

## Failure Matrix: Quick Lookup

| Symptom / Error Message | Root Cause | Fix Section |
|---|---|---|
| `CondaHTTPError: HTTP 000 CONNECTION FAILED` | Attempted `conda env create` on air-gapped PC | [§1](#1-attempting-conda-env-create-on-the-offline-machine) |
| `%1 is not a valid Win32 application` / `Exec format error` | Built environment on macOS or Linux instead of Windows x64 | [§2](#2-operating-system-abi-mismatch-maclinux-vs-windows) |
| `Fatal Python error: init_fs_encoding: failed to get Python codec` | Raw folder copied without `conda-pack` / `conda-unpack` | [§3](#3-un-relocated-prefixes-missing-conda-unpack) |
| Upgraded packages do not take effect; old version still runs | Stale `environment\env` directory was not deleted | [§4](#4-stale-extracted-environment-cache) |
| `[WARN] conda-unpack not found` | `conda-pack` package was omitted from the environment | [§5](#5-omitting-conda-pack-from-the-environment) |
| `ImportError: DLL load failed while importing _C` in PyTorch | CUDA PyTorch installed instead of `pytorch-cpu` | [§6](#6-cudagpu-pytorch-instead-of-pytorch-cpu) |
| `VCRUNTIME140.dll was not found` | `Library\bin` missing from `PATH` or missing MSVC redistributable | [§7](#7-missing-visual-c-redistributables--dll-path-failure) |
| `ImportError: cannot import name 'fitz'` / ABI crash | Python was upgraded to 3.12/3.13 with unverified wheels | [§8](#8-python-minor-version-breakage-311-vs-312313) |
| `verify_environment.py` exits 1 on Tesseract check | Accidental inclusion of `pytesseract` violates offline policy | [§9](#9-regression-guard-failures-in-verify_environmentpy) |

---

## 1. Attempting `conda env create` on the Offline Machine

### The Symptom
Running this on the target offline PC:
```cmd
conda env create -f environment.yml
```
Fails immediately with:
```
CondaHTTPError: HTTP 000 CONNECTION FAILED for url <https://conda.anaconda.org/conda-forge/win-64/...>
Elapsed: -
An HTTP error occurred when trying to retrieve this URL.
HTTP errors are often intermittent, and a simple retry will get you through.
```

### Root Cause
`environment.yml` contains package *names*, not package *binaries*. Conda must contact `conda-forge` or other package repositories over the internet to solve the SAT dependency graph, download `.conda` / `.tar.bz2` tarballs, and build the environment. On an isolated LAN without internet, Conda cannot download anything.

### Solution
- **NEVER** run `conda env create` on the offline machine.
- Run `conda env create` exclusively on an **online Windows build machine**.
- Pack the environment into `specguard-conda.tar.gz` using `conda-pack`.
- Transfer only the `.tar.gz` archive to the offline system.

---

## 2. Operating System & ABI Mismatch (Mac/Linux vs Windows)

### The Symptom
When double-clicking `START_SPECguard.bat` or invoking `python.exe` on Windows:
```
'%ENV_DIR%\python.exe' is not recognized as an internal or external command
```
Or a Windows dialog:
```
This app can't run on your PC. To find a version for your PC, check with the software publisher.
```
Or in logs:
```
%1 is not a valid Win32 application.
```

### Root Cause
Python environments that include scientific computing libraries (`numpy`, `pandas`, `torch`, `cv2`, `fitz`) are **NOT platform-independent byte-code**. They contain compiled native machine code:
- On macOS (Darwin arm64/x86_64): Mach-O binary executables and `.dylib` files.
- On Linux (x86_64): ELF binary executables and `.so` files.
- On Windows (win-64): PE32+ `.exe` executables and `.dll` files.

If you generate or pack an environment while working on a Mac or Linux laptop, those binaries **cannot execute on Windows**.

### Solution
- You **MUST** build and pack the environment on a **Windows 10/11 x64 machine** (or a Windows x64 CI/CD runner / VM).
- A Mac or Linux machine cannot produce a runnable Windows Conda-Pack archive.

---

## 3. Un-Relocated Prefixes (Missing `conda-unpack`)

### The Symptom
Upon running the application on the offline machine:
```
Fatal Python error: init_fs_encoding: failed to get the Python codec of the filesystem encoding
Python path configuration:
  PYTHONHOME = (not set)
  PYTHONPATH = (not set)
  program name = 'C:\Users\old_build_user\anaconda3\envs\specguard\python.exe'
FileNotFoundError: No module named 'encodings'
```

### Root Cause
Conda bakes the absolute path of the build directory into binaries and shebang lines. Simply creating a zip file of the environment folder retains hardcoded paths pointing to the build machine's file system (e.g. `C:\Users\yoges\anaconda3...`). When extracted on a target PC at `D:\Deployment\environment\env`, Python attempts to locate its standard library on the non-existent `C:\Users\...` path.

### Solution
1. Ensure the environment is archived using `conda-pack`:
   ```cmd
   conda pack -n specguard -o specguard-conda.tar.gz
   ```
2. Ensure `conda-unpack.exe` runs upon extraction. In `START_SPECguard.bat`:
   ```cmd
   "%ENV_DIR%\Scripts\conda-unpack.exe"
   ```
   This dynamically rewrites every binary header and shebang line to match the target machine's current extraction path.

---

## 4. Stale Extracted Environment Cache

### The Symptom
You built a new `specguard-conda.tar.gz` with upgraded packages, copied it over to `environment\specguard-conda.tar.gz`, and ran `START_SPECguard.bat`. However:
- The new packages are not available.
- Bugfixes or upgrades are absent.
- The logs still show the old package versions.

### Root Cause
Look at lines 54-74 of `START_SPECguard.bat`:
```bat
if not exist "%ENV_DIR%\python.exe" (
    echo [1/4] Extracting packed Conda environment (first run, please wait)...
    powershell -Command "tar -xzf '%ENV_TARBALL%' -C '%ENV_DIR%'..."
) else (
    echo [1/4] Packed environment already extracted.
)
```
If `environment\env\python.exe` already exists from the previous run, the launcher assumes the environment is already extracted and **completely ignores your new tarball!** Furthermore, if `environment\env\.unpacked` exists, `conda-unpack` will also be skipped.

### Solution
Whenever deploying an upgraded `specguard-conda.tar.gz` to the offline machine:
1. Stop the running server: `STOP_SPECguard.bat`.
2. Delete the old extracted directory:
   ```cmd
   rmdir /s /q environment\env
   ```
   (Or use `rules\scripts\refresh_offline_target.bat`).
3. Now run `START_SPECguard.bat`. It will detect that `%ENV_DIR%\python.exe` is absent, cleanly extract the new tarball, run `conda-unpack`, and execute the upgraded runtime.

---

## 5. Omitting `conda-pack` from the Environment

### The Symptom
Extraction finishes, but the launch log displays:
```
[WARN] conda-unpack not found. Assuming the environment is already relocated.
```
And then executing any entry point fails with file path or import errors.

### Root Cause
`conda-unpack.exe` is provided by the `conda-pack` package itself. If `conda-pack` is only installed in the base Conda environment on the build host and NOT in the target `specguard` environment, the tool is not placed into `%ENV_DIR%\Scripts\conda-unpack.exe`.

### Solution
Always include `conda-pack` in the environment dependencies before packing:
```cmd
conda install -n specguard -c conda-forge conda-pack -y
```
Or in `environment.yml`:
```yaml
dependencies:
  - conda-pack
```

---

## 6. CUDA/GPU PyTorch Instead of `pytorch-cpu`

### The Symptom
On the target machine:
```
ImportError: DLL load failed while importing _C: The specified module could not be found.
```
Or the packed archive size balloons to 5 GB+ (compressed) and 12 GB+ (uncompressed).

### Root Cause
SpecGuard's router `specguard/server/api/models_api.py` imports `torch` at top-level. If `environment.yml` declares `torch` or `pytorch` without restricting to CPU:
- Conda resolves the default NVIDIA CUDA runtime packages (`cudatoolkit`, `cublas`, `cudnn`, `nvrtc`).
- On target air-gapped office PCs without dedicated NVIDIA GPUs or matching display drivers, native initialization of `_C.pyd` fails immediately.

### Solution
Always explicitly install the CPU-only build:
```yaml
dependencies:
  - pytorch-cpu>=2.0.0
```
Or via conda CLI:
```cmd
conda install -n specguard -c conda-forge pytorch-cpu -y
```

---

## 7. Missing Visual C++ Redistributables & DLL Path Failure

### The Symptom
```
ImportError: DLL load failed while importing cv2: The specified module could not be found.
```
Or:
```
The code execution cannot proceed because VCRUNTIME140.dll was not found.
```

### Root Cause
Conda packages compiled with MSVC (such as OpenCV, PyTorch, PyMuPDF, SQLite) require Windows C++ runtimes (`vcruntime140.dll`, `msvcp140.dll`). Conda bundles these under `%ENV_DIR%\Library\bin`.  
If an offline script launches Python directly without adding `%ENV_DIR%\Library\bin` to `PATH`, Windows cannot resolve these DLLs.

### Solution
In all launcher scripts, ensure `PATH` is explicitly prepended:
```bat
set "PATH=%ENV_DIR%;%ENV_DIR%\Library\bin;%ENV_DIR%\Library\mingw-w64\bin;%ENV_DIR%\Library\usr\bin;%ENV_DIR%\Scripts;%ENV_DIR%\bin;%PATH%"
```
`START_SPECguard.bat` already has this line configured.

---

## 8. Python Minor Version Breakage (3.11 vs 3.12/3.13)

### The Symptom
Upgrading Python from 3.11 to 3.12 or 3.14 breaks binary dependencies:
```
No matching distribution found for onnxruntime
```
Or during `verify_environment.py`:
```
Native OpenCV / PyMuPDF failed: symbol lookup error
```

### Root Cause
SpecGuard was authored, profiled, and hardened against Python 3.11. Packages like `onnxruntime`, `pymupdf`, and `torch` have tight C-API couplings. Conda-forge often has delayed or unstable Windows builds for newer Python minor releases.

### Solution
Stick strictly to **Python 3.11**:
```yaml
dependencies:
  - python=3.11
```
Never bump Python to 3.12+ unless all dependencies have been validated through `verify_environment.py`.

---

## 9. Regression Guard Failures in `verify_environment.py`

### The Symptom
The environment extracts and runs, but during startup or check, `verify_environment.py` returns:
```
[FAIL] assertion:no-pytesseract - VIOLATION: pytesseract is installed!
```
And `START_SPECguard.bat` aborts with `STARTUP FAILED`.

### Root Cause
SpecGuard has an architectural policy forbidding Tesseract OCR in favor of its built-in self-contained OpenCV morphological engine (see `CONDA_RUNTIME_AUDIT.md` §11). `verify_environment.py` intentionally fails if `pytesseract` is imported to prevent regressions.

### Solution
Do **NOT** add `pytesseract` or `tesseract` to `environment.yml`. SpecGuard's offline vision engine uses built-in OpenCV algorithms.
