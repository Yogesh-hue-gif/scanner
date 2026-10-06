@echo off
REM ==============================================================================
REM SpecGuard — Production Offline Launcher (Windows x64 Conda-Pack Deployment)
REM Starts the local FastAPI web server on 0.0.0.0:8765
REM ==============================================================================

setlocal enabledelayedexpansion
set SCRIPT_DIR=%~dp0
set ENV_DIR=%SCRIPT_DIR%environment\specguard
set PYTHON_EXE=%ENV_DIR%\python.exe

if not exist "%PYTHON_EXE%" (
    if exist "%SCRIPT_DIR%environment\specguard-conda.tar.gz" (
        echo [INFO] Unpacking Conda-Pack environment archive...
        echo [INFO] This is a one-time operation on initial launch.
        mkdir "%ENV_DIR%" 2>nul
        tar -xzf "%SCRIPT_DIR%environment\specguard-conda.tar.gz" -C "%ENV_DIR%"
    ) else (
        for /f "tokens=*" %%i in ('where python 2^>nul') do (
            if not defined PYTHON_EXE set PYTHON_EXE=%%i
        )
    )
)

if not exist "%PYTHON_EXE%" (
    echo [ERROR] No Python runtime found in %ENV_DIR% or system PATH.
    echo Please verify that environment\specguard-conda.tar.gz exists.
    pause
    exit /b 1
)

if exist "%SCRIPT_DIR%app\app.py" (
    set APP_DIR=%SCRIPT_DIR%app
) else (
    set APP_DIR=%SCRIPT_DIR%
)

REM Setup PATH and OCR Environment
set PATH=%ENV_DIR%;%ENV_DIR%\Scripts;%ENV_DIR%\Library\bin;%SCRIPT_DIR%runtime\tesseract;%PATH%
if exist "%SCRIPT_DIR%runtime\tesseract\tessdata" (
    set TESSDATA_PREFIX=%SCRIPT_DIR%runtime\tesseract\tessdata
)

set SPECGUARD_APP_DIR=%APP_DIR%
set SPECGUARD_DATA_DIR=%SCRIPT_DIR%data
set SPECGUARD_HOST=0.0.0.0
set SPECGUARD_PORT=8765

REM --- First-click LAN: ensure Windows Firewall allows inbound TCP on 8765 (Private) ---
REM Needs admin once; silently skips if not elevated or rule exists.
netsh advfirewall firewall show rule name="SpecGuard 8765" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Adding Windows Firewall rule for TCP 8765 (Private) for LAN access...
    netsh advfirewall firewall add rule name="SpecGuard 8765" dir=in action=allow protocol=TCP localport=8765 profile=private >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Firewall rule added: SpecGuard 8765 (Private).
    ) else (
        echo [INFO] Could not auto-add firewall rule (run once as Administrator for LAN access).
        echo [INFO] Manual: New-NetFirewallRule -DisplayName "SpecGuard 8765" -Direction Inbound -Protocol TCP -LocalPort 8765 -Profile Private -Action Allow
    )
) else (
    echo [OK] Firewall rule present: SpecGuard 8765.
)

echo ==============================================================================
echo   SpecGuard — Engineering Document Quality ^& Compliance Inspection Platform
echo ==============================================================================
echo [INFO] Runtime Environment:  %ENV_DIR%
echo [INFO] Starting 100%% Offline Web Server...
echo [INFO] Local Web UI:         http://localhost:8765
echo [INFO] LAN Access:           checking host IPv4 addresses...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set _ip=%%a
    setlocal enabledelayedexpansion
    set _ip=!_ip: =!
    echo [INFO]   LAN client URL:      http://!_ip!:8765
    endlocal
)
echo [INFO] Clients need same WiFi/LAN, no install. If blocked, allow TCP 8765 Private.
echo [INFO] Press Ctrl+C or run STOP_SPECguard.bat to stop the server.
echo ==============================================================================

cd /d "%APP_DIR%"
"%PYTHON_EXE%" app.py --host 0.0.0.0 --port 8765
