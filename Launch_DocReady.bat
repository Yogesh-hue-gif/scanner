@echo off
setlocal enabledelayedexpansion

title DocReady — Offline Engineering Document Readiness Verification
echo ===============================================================================
echo          DOCREADY — WINDOWS x64 OFFLINE EDITION v1.0
echo   Automated Engineering Specification Quality & Compliance Verification
echo ===============================================================================
echo.

:: 1. Resolve Installation Root Directory
set "INSTALL_DIR=%~dp0"
if "%INSTALL_DIR:~-1%"=="\" set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
cd /d "%INSTALL_DIR%"

:: 2. Configure Writable Data and Log Directories
set "DOCREADY_DATA_DIR=%INSTALL_DIR%\data"
set "DOCREADY_LOG_DIR=%INSTALL_DIR%\logs"
if not exist "%DOCREADY_DATA_DIR%" mkdir "%DOCREADY_DATA_DIR%"
if not exist "%DOCREADY_DATA_DIR%\uploads" mkdir "%DOCREADY_DATA_DIR%\uploads"
if not exist "%DOCREADY_LOG_DIR%" mkdir "%DOCREADY_LOG_DIR%"

:: 3. Resolve Python Runtime (Packed Environment or Active Conda)
set "PYTHON_EXE="
if exist "%INSTALL_DIR%\environment\python.exe" (
    set "PYTHON_EXE=%INSTALL_DIR%\environment\python.exe"
    echo [INFO] Using packaged runtime: %INSTALL_DIR%\environment
) else if exist "%CONDA_PREFIX%\python.exe" (
    set "PYTHON_EXE=%CONDA_PREFIX%\python.exe"
    echo [INFO] Using active conda runtime: %CONDA_PREFIX%
) else if exist "C:\Users\%USERNAME%\anaconda3\envs\specguard\python.exe" (
    set "PYTHON_EXE=C:\Users\%USERNAME%\anaconda3\envs\specguard\python.exe"
    echo [INFO] Using specguard conda runtime
) else (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=python"
        echo [INFO] Using system python runtime
    ) else (
        echo [ERROR] No compatible Python runtime found!
        echo Please ensure Conda-Pack environment is unpacked or Conda is installed.
        pause
        exit /b 1
    )
)

:: 4. Set Environment Variables
set "PYTHONPATH=%INSTALL_DIR%"
set "DOCREADY_ROOT=%INSTALL_DIR%"
set "DOCREADY_HOST=127.0.0.1"
set "DOCREADY_PORT=8765"
set "LOG_FILE=%DOCREADY_LOG_DIR%\docready.log"

echo [INFO] Verifying local database and model inventories...
"%PYTHON_EXE%" -c "from specguard.storage.database import DatabaseManager; from specguard.core.models import Finding; dm = DatabaseManager(); print('[INFO] Database verified successfully.')" >> "%LOG_FILE%" 2>&1
if !errorlevel! neq 0 (
    echo [WARNING] Database initialization check had warnings. See %LOG_FILE%
)

:: 5. Launch DocReady Background Service
echo [INFO] Launching DocReady on loopback http://127.0.0.1:8765 ...
start /b "" "%PYTHON_EXE%" -m uvicorn specguard.server.app:app --host 127.0.0.1 --port 8765 --log-level info >> "%LOG_FILE%" 2>&1

:: 6. Poll Health Endpoint until Ready
echo [INFO] Waiting for application startup...
set "HEALTH_URL=http://127.0.0.1:8765/health"
set "READY=0"

for /l %%i in (1,1,30) do (
    powershell -NoProfile -Command "(Invoke-WebRequest -Uri '%HEALTH_URL%' -UseBasicParsing -TimeoutSec 1).StatusCode" >nul 2>&1
    if !errorlevel! equ 0 (
        set "READY=1"
        goto :SERVER_READY
    )
    timeout /t 1 /nobreak >nul
)

:SERVER_READY
if "%READY%"=="1" (
    echo.
    echo ===============================================================================
    echo   DocReady is ONLINE and READY!
    echo   Local URL: http://127.0.0.1:8765
    echo   Mode: 100%% Air-Gapped Offline Verification
    echo ===============================================================================
    echo.
    start "" "http://127.0.0.1:8765/#home"
) else (
    echo.
    echo [ERROR] Application failed to respond within 30 seconds.
    echo Check diagnostic logs at: %LOG_FILE%
    echo.
    pause
    exit /b 1
)

echo Press CTRL+C or close this window to stop the DocReady server.
echo.
"%PYTHON_EXE%" -c "import time; time.sleep(86400)" >nul 2>&1

endlocal
