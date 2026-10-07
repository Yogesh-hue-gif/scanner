@echo off
REM ==============================================================================
REM SpecGuard — Production Offline Launcher (Windows x64 Conda-Pack Deployment)
REM Starts the local FastAPI web server on 0.0.0.0:8765
REM Compliant with SpecGuard Architecture & Dual-Host Conda-Pack Rules
REM ==============================================================================

setlocal enabledelayedexpansion
title SpecGuard - Production Server

set "SCRIPT_DIR=%~dp0"
set "ROOT=%SCRIPT_DIR%"
set "ENV_DIR=%ROOT%environment\env"
set "ENV_TARBALL=%ROOT%environment\specguard-conda.tar.gz"
set "PYTHON_EXE=%ENV_DIR%\python.exe"
set "UNPACK_EXE=%ENV_DIR%\Scripts\conda-unpack.exe"
set "UNPACKED_MARKER=%ENV_DIR%\.unpacked"
set "DATA_DIR=%ROOT%data"

if exist "%ROOT%app\app.py" (
    set "APP_DIR=%ROOT%app"
) else (
    set "APP_DIR=%ROOT%"
)

echo ==============================================================================
echo   SpecGuard — Engineering Document Quality ^& Compliance Inspection Platform
echo ==============================================================================
echo   Target Platform : Windows x64 (win-64)
echo   Network Mode    : 100%% Offline / Air-Gapped Intranet
echo   Deployment Path : %ROOT%
echo.

REM --- [1/4] Environment Extraction & Prefix Relocation (Rule 01, 02, 05) ---
if not exist "%PYTHON_EXE%" (
    if exist "%ENV_TARBALL%" (
        echo [1/4] Extracting packed Conda environment (first run, please wait)...
        if not exist "%ENV_DIR%" mkdir "%ENV_DIR%"
        tar -xzf "%ENV_TARBALL%" -C "%ENV_DIR%"
        if errorlevel 1 (
            echo [ERROR] Failed to extract archive: %ENV_TARBALL%
            echo Please ensure tar.exe is present and archive is not corrupted.
            pause
            exit /b 1
        )
        echo [OK] Archive extracted to %ENV_DIR%.

        if exist "%UNPACK_EXE%" (
            echo [INFO] Running conda-unpack to relocate environment paths...
            call "%UNPACK_EXE%"
            if errorlevel 1 (
                echo [ERROR] conda-unpack relocation failed!
                pause
                exit /b 1
            )
            type nul > "%UNPACKED_MARKER%"
            echo [OK] Path relocation complete (.unpacked marker created).
        ) else (
            echo [WARN] conda-unpack.exe not found at %UNPACK_EXE%.
            echo        Assuming environment was pre-relocated.
        )
    ) else (
        echo [NOTICE] Packed archive not found at %ENV_TARBALL%.
        echo Checking system PATH for fallback Python...
        for /f "tokens=*" %%i in ('where python 2^>nul') do (
            if not defined PYTHON_EXE set "PYTHON_EXE=%%i"
        )
    )
) else (
    echo [1/4] Packed environment already extracted: %ENV_DIR%
    if not exist "%UNPACKED_MARKER%" (
        if exist "%UNPACK_EXE%" (
            echo [INFO] Environment exists but relocation marker missing. Running conda-unpack...
            call "%UNPACK_EXE%"
            type nul > "%UNPACKED_MARKER%"
            echo [OK] Path relocation complete (.unpacked marker created).
        )
    )
)

if not exist "%PYTHON_EXE%" (
    echo [ERROR] No Python runtime found in %ENV_DIR% or system PATH.
    echo Please verify that environment\specguard-conda.tar.gz exists.
    pause
    exit /b 1
)

REM --- [2/4] Runtime Isolation Environment Variables (Rule 01 §5 & Rule 02 §7) ---
echo [2/4] Setting isolated runtime environment variables...
set "PYTHONHOME=%ENV_DIR%"
set "PYTHONPATH=%APP_DIR%"
set "PATH=%ENV_DIR%;%ENV_DIR%\Library\bin;%ENV_DIR%\Library\mingw-w64\bin;%ENV_DIR%\Library\usr\bin;%ENV_DIR%\Scripts;%ENV_DIR%\bin;%PATH%"

set "HF_HUB_OFFLINE=1"
set "TRANSFORMERS_OFFLINE=1"
set "SPECGUARD_DATA_DIR=%DATA_DIR%"
set "SPECGUARD_APP_DIR=%APP_DIR%"
set "SPECGUARD_HOST=0.0.0.0"
set "SPECGUARD_PORT=8765"

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%" 2>nul

REM --- [3/4] In-Situ Native Environment Verification (Rule 05 §2 & Rule 02 §9) ---
echo [3/4] Running pre-launch automated environment verification...
if exist "%ROOT%verify_environment.py" (
    "%PYTHON_EXE%" "%ROOT%verify_environment.py"
    if errorlevel 1 (
        echo.
        echo [FATAL] Environment verification failed! Broken dependencies or regressions detected.
        echo         Server startup aborted. Run rules\scripts\rebuild_and_pack.bat to fix.
        pause
        exit /b 1
    )
) else (
    echo [INFO] verify_environment.py not found in root, proceeding.
)

REM --- [4/4] First-Click LAN Firewall & Server Launch ---
echo [4/4] Checking Windows Firewall rules...
netsh advfirewall firewall show rule name="SpecGuard 8765" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Adding Windows Firewall rule for TCP 8765 [Private] for LAN access...
    netsh advfirewall firewall add rule name="SpecGuard 8765" dir=in action=allow protocol=TCP localport=8765 profile=private >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Firewall rule added: SpecGuard 8765 [Private].
    ) else (
        echo [INFO] Could not auto-add firewall rule. Run once as Administrator if LAN access is needed.
    )
) else (
    echo [OK] Firewall rule present: SpecGuard 8765.
)

echo.
echo ==============================================================================
echo   SERVER STARTING — 100%% OFFLINE LAN/INTRANET MODE
echo ==============================================================================
echo   Runtime Environment: %ENV_DIR%
echo   Local Web UI       : http://localhost:8765
echo   LAN Client URLs    :
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set "_ip=%%a"
    set "_ip=!_ip: =!"
    echo     http://!_ip!:8765
)
echo.
echo   Clients need same WiFi/LAN, no install needed.
echo   Press Ctrl+C or run STOP_SPECguard.bat to stop the server.
echo ==============================================================================
echo.

cd /d "%APP_DIR%"
"%PYTHON_EXE%" app.py --host 0.0.0.0 --port 8765
