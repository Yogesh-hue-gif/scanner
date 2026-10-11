# Rule 05: Offline Target Deployment & Environment Refresh Rules

> **Scope:** Operating procedures on the air-gapped target machine when deploying a new or upgraded `specguard-conda.tar.gz`.

---

## 1. The Cache-Busting Rule (MANDATORY)

When a new `specguard-conda.tar.gz` is copied to the offline machine:

> [!WARNING]
> Simply replacing `specguard-conda.tar.gz` is NOT ENOUGH!  
> You MUST delete the existing `environment\env` folder!

### Why?
`START_SPECguard.bat` implements an optimization check to avoid re-extracting a 1.3 GB archive on every single startup:
```bat
if not exist "%ENV_DIR%\python.exe" (
    REM Extract archive...
) else (
    echo [1/4] Packed environment already extracted.
)
```
If `environment\env\python.exe` already exists from an earlier version:
- The launcher **skips extraction entirely**.
- The server boots using the **old** environment.
- The new packages and fixes will **never execute**.

---

## 2. Standard Deployment Procedure on the Offline Machine

Follow this exact 5-step sequence whenever deploying an upgrade:

### Step 1: Stop the Running Server
```cmd
call STOP_SPECguard.bat
```
Wait until the server process terminates and releases any file locks on `data\specguard.pid` and DLLs.

### Step 2: Wipe the Old Environment Directory
```cmd
rmdir /s /q environment\env
```
*(Or double-click `rules\scripts\refresh_offline_target.bat`)*

> [!NOTE]
> Deleting `environment\env` is completely safe. The environment is stateless and disposable. All persistent data (database, uploads, reports) lives in `data\`, which is never touched during this process.

### Step 3: Copy the New Tarball
Place the newly built `specguard-conda.tar.gz` into the `environment\` folder:
```
SpecGuard-Offline-Conda\environment\specguard-conda.tar.gz
```

### Step 4: Verify Cryptographic Integrity
Verify the file was not corrupted during USB/media transfer:
```cmd
certutil -hashfile environment\specguard-conda.tar.gz SHA256
```
Compare the output against the hash in `SHA256SUMS.txt`.

### Step 5: Start SpecGuard
```cmd
call START_SPECguard.bat
```

What `START_SPECguard.bat` does automatically:
1. Detects that `environment\env\python.exe` is absent.
2. Extracts `specguard-conda.tar.gz` into `environment\env\` using Windows built-in `tar.exe`.
3. Invokes `environment\env\Scripts\conda-unpack.exe` to rewrite all absolute path prefixes to the local directory.
4. Creates the `environment\env\.unpacked` marker file.
5. Configures runtime environment variables (`PYTHONHOME`, `PYTHONPATH`, `PATH`).
6. Starts the Uvicorn web server detached on `0.0.0.0:8765`.
7. Performs an automated self-test via `verify_environment.py`.
