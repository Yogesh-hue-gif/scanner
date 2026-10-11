# Rule 01: Offline Conda Architecture & Conda-Pack Mechanics

> **Scope:** Architectural understanding of how SpecGuard achieves 100% offline, isolated LAN execution without Conda, Python, or pip installed on the target machine.

---

## 1. Dual-Host Architecture

SpecGuard's deployment model separates the build lifecycle from the execution runtime across two completely distinct environments:

```
[ ONLINE BUILD HOST ]                                   [ AIR-GAPPED TARGET HOST ]
+----------------------------+                          +-------------------------------+
| * OS: Windows 10/11 x64    |                          | * OS: Windows 10/11 x64       |
| * Internet: ENABLED        |                          | * Internet: ZERO / AIR-GAPPED |
| * Conda/Miniconda: YES     |                          | * Conda/Miniconda: NOT NEEDED |
| * Channel: conda-forge     |                          | * Python / Pip: NOT NEEDED    |
| * Steps:                   |                          | * Admin Rights: NOT NEEDED    |
|   1. Solve dependencies    |                          |                               |
|   2. Download packages     |   specguard-conda.tar.gz | * Steps:                      |
|   3. Run native verify     | =======================> |   1. Extract tarball          |
|   4. conda-pack archive    |   (via USB / Secure Net) |   2. Run conda-unpack.exe     |
|   5. Compute SHA-256 sums  |                          |   3. Launch on 0.0.0.0:8765   |
+----------------------------+                          +-------------------------------+
```

---

## 2. Why Simply Copying a Conda Environment Fails

When Conda installs a package into `C:\Users\yoges\anaconda3\envs\specguard`:
1. **Shebang Headers:** Every Python CLI script (under `Scripts\*.exe` and `Scripts\*.py`) hardcodes the absolute interpreter path:
   ```
   #!C:\Users\yoges\anaconda3\envs\specguard\python.exe
   ```
2. **Binary DLL Links & Manifests:** Compiled libraries (such as `libopenblas.dll`, `sqlite3.dll`, etc.) encode the build prefix directly into their binary headers or embedded pkg-config files.
3. **Registry and Virtual Environments:** Windows does not use standard symlinks by default; file paths are absolute.

If this directory is zipped and extracted on another machine (e.g. `D:\SpecGuard\environment\env`), executing `python.exe` or any tool immediately results in:
```
Fatal Python error: init_fs_encoding: failed to get the Python codec of the filesystem encoding
Python path configuration:
  PYTHONHOME = (not set)
  PYTHONPATH = (not set)
  program name = 'C:\Users\yoges\anaconda3\envs\specguard\python.exe'
FileNotFoundError: No module named 'encodings'
```
Or:
```
The system cannot find the path specified.
```

---

## 3. How `conda-pack` Solves Path Relocation

`conda-pack` is a tool specifically designed to archive an environment and make it relocatable:

1. **Build-Time Scanning:**
   When running `conda pack -n specguard -o specguard-conda.tar.gz`:
   - It identifies all text files and binary files that contain the build prefix string.
   - It appends a metadata table and injects the `conda-unpack` tool into `Scripts\conda-unpack.exe`.
2. **Transfer:**
   The compressed tarball (`specguard-conda.tar.gz`, ~1.25 GB) contains all standard library files, site-packages, compiled DLLs, and the relocation manifest.
3. **Target-Time Relocation (`conda-unpack.exe`):**
   When `START_SPECguard.bat` extracts the tarball into `%ENV_DIR%` (`.../environment/env`), it invokes:
   ```cmd
   "%ENV_DIR%\Scripts\conda-unpack.exe"
   ```
   `conda-unpack` inspects the environment's current absolute path on the offline machine and:
   - Binary-patches Windows `.exe` entry points.
   - Text-replaces the shebang headers in all scripts.
   - Rewrites prefix references inside site-packages.
   - Writes the `.unpacked` marker.

---

## 4. The SpecGuard Directory Hierarchy

Every component of the deployment has a strictly enforced lifecycle role:

```
SpecGuard-Offline-Conda/
├── START_SPECguard.bat          <- Production launcher (extracts, unpacks, boots server)
├── STOP_SPECguard.bat           <- Graceful shutdown script
├── CHECK_SPECguard.bat          <- Pre-flight verification test suite
├── verify_environment.py        <- Comprehensive dependency & native library probe
├── MODEL_MANIFEST.json          <- Machine-readable audit of model fallback status
├── SHA256SUMS.txt               <- Cryptographic hash verification manifest
│
├── app/                         <- READ-ONLY application code & resources
│   ├── app.py                   <- Server entry point (FastAPI / Uvicorn)
│   ├── specguard/               <- Core inspection package
│   ├── rules/                   <- Compliance & quality rules
│   ├── standards/               <- Engineering standards knowledge base
│   └── templates/               <- Domain checklist templates
│
├── data/                        <- SOLE WRITABLE DIRECTORY
│   ├── database/                <- SQLite database (persistence)
│   ├── uploads/                 <- PDF/DOCX input documents
│   ├── reports/                 <- Generated HTML/PDF inspection reports
│   └── logs/                    <- Server log & diagnostic dumps
│
└── environment/
    ├── specguard-conda.tar.gz   <- THE FROZEN RUNTIME ARTIFACT (Transferable)
    └── env/                     <- EXTRACTED RUNTIME (Created on first run by .bat)
        ├── python.exe           <- Relocated Python executable
        ├── Scripts/             <- Relocated scripts (including conda-unpack.exe)
        ├── Library/bin/         <- Bundled native DLLs (OpenCV, Torch, OpenSSL, etc.)
        └── .unpacked            <- Marker indicating relocation was successful
```

---

## 5. Runtime Environment Variables

To guarantee total isolation from any host-installed Python or tools, `START_SPECguard.bat` explicitly configures the runtime environment prior to launching `python.exe`:

| Environment Variable | Target Value | Purpose |
|---|---|---|
| `PYTHONHOME` | `%ENV_DIR%` | Directs Python to load stdlib & packages only from the bundled environment. |
| `PYTHONPATH` | `%APP_DIR%` | Places SpecGuard application code into the Python import path. |
| `PATH` | `%ENV_DIR%;%ENV_DIR%\Library\bin;%ENV_DIR%\Library\mingw-w64\bin;%ENV_DIR%\Scripts;...` | Ensures Windows loads the bundled native DLLs (OpenCV, PyTorch, MuPDF) rather than system-wide DLLs. |
| `HF_HUB_OFFLINE` | `1` | Disables HuggingFace network telemetry and download attempts. |
| `TRANSFORMERS_OFFLINE`| `1` | Forces transformers to use local cache only. |
| `SPECGUARD_DATA_DIR` | `%DATA_DIR%` | Directs all database, upload, and log writes to `data/`. |
| `SPECGUARD_APP_DIR`  | `%APP_DIR%`  | Pins application resource resolvers to the packaged tree. |

---

## 6. Takeaway for Creating Upgrades

You cannot simply edit `environment.yml` and copy that text file to the offline machine.  
**Upgrading an offline system means producing a NEW `specguard-conda.tar.gz` on an online build host and replacing the archive on the offline target.**
