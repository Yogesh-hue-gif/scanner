@echo off
setlocal enabledelayedexpansion

title DocReady — Offline Engineering Document Readiness Verification
echo ===============================================================================
echo          DOCREADY — WINDOWS x64 OFFLINE EDITION v1.0
echo   Automated Engineering Specification Quality ^& Compliance Verification
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

set "LOG_FILE=%DOCREADY_LOG_DIR%\docready.log"
set "PID_FILE=%DOCREADY_LOG_DIR%\docready.pid"

:: 3. Strict Bundled Python Resolution (NO DEVELOPMENT MACHINE FALLBACKS)
set "RUNTIME_DIR=%INSTALL_DIR%\runtime"
set "PYTHON_EXE=%RUNTIME_DIR%\python.exe"

if not exist "%PYTHON_EXE%" (
    echo [ERROR] Self-contained Conda-Pack runtime not found!
    echo Expected: %PYTHON_EXE%
    echo.
    echo The production release requires the bundled Windows x64 runtime folder.
    echo Please ensure the release ZIP was completely extracted.
    echo.
    pause
    exit /b 1
)

:: 4. Initialize Conda-Pack Relocation (if conda-unpack exists and not yet initialized)
if exist "%RUNTIME_DIR%\Scripts\conda-unpack.exe" (
    if not exist "%RUNTIME_DIR%\.unpacked" (
        echo [INFO] Performing one-time runtime prefix relocation ^(conda-unpack^)...
        call "%RUNTIME_DIR%\Scripts\conda-unpack.exe" >> "%LOG_FILE%" 2>&1
        echo unpacked > "%RUNTIME_DIR%\.unpacked"
    )
)

:: 5. Set Isolated Environment Variables
set "PATH=%RUNTIME_DIR%;%RUNTIME_DIR%\Library\bin;%RUNTIME_DIR%\Scripts;%RUNTIME_DIR%\Library\usr\bin;%RUNTIME_DIR%\Library\mingw-w64\bin;%PATH%"
set "PYTHONHOME=%RUNTIME_DIR%"
set "PYTHONPATH=%INSTALL_DIR%"
set "DOCREADY_ROOT=%INSTALL_DIR%"
set "DOCREADY_HOST=127.0.0.1"
set "DOCREADY_PORT=8765"
set "SPECGUARD_APP_DIR=%INSTALL_DIR%"
set "SPECGUARD_DATA_DIR=%DOCREADY_DATA_DIR%"

:: 6. Preflight Diagnostic Checks
echo [INFO] Running offline preflight checks...
"%PYTHON_EXE%" -c "import fitz, cv2, torch, onnxruntime, fastapi, uvicorn; from specguard.storage.database import DatabaseManager; dm = DatabaseManager(); print('Preflight OK')" >> "%LOG_FILE%" 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Preflight initialization check failed!
    echo Diagnostic details saved to: %LOG_FILE%
    echo.
    pause
    exit /b 1
)

:: 7. Clean up any previous stale PID file
if exist "%PID_FILE%" del /f /q "%PID_FILE%" >nul 2>&1

:: 8. Launch DocReady Background Service with Process ID Tracking
echo [INFO] Starting DocReady on loopback http://127.0.0.1:8765 ...
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "$proc = Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList '-m uvicorn specguard.server.app:app --host 127.0.0.1 --port 8765 --log-level info' -WorkingDirectory '%INSTALL_DIR%' -RedirectStandardOutput '%LOG_FILE%' -RedirectStandardError '%DOCREADY_LOG_DIR%\uvicorn_err.log' -PassThru; $proc.Id"') do (
    set "SERVER_PID=%%a"
)

echo %SERVER_PID% > "%PID_FILE%"
echo [INFO] Background service active ^(PID: %SERVER_PID%^)

:: 9. Poll Health Endpoint until Ready (Up to 30 Seconds)
echo [INFO] Waiting for service readiness at http://127.0.0.1:8765/health ...
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
    echo   Mode: 100%%%% Air-Gapped Offline Verification ^(No Internet Required^)
    echo ===============================================================================
    echo.
    start "" "http://127.0.0.1:8765/#home"
) else (
    echo.
    echo [ERROR] Application failed to respond within 30 seconds.
    echo Diagnostic logs preserved at: %LOG_FILE%
    echo.
    if not "%SERVER_PID%"=="" taskkill /F /T /PID %SERVER_PID% >nul 2>&1
    pause
    exit /b 1
)

echo.
echo [INFO] Press any key or close this window to stop DocReady and shut down...
pause >nul

echo [INFO] Terminating DocReady process tree ^(PID: %SERVER_PID%^)...
if not "%SERVER_PID%"=="" (
    taskkill /F /T /PID %SERVER_PID% >nul 2>&1
)
if exist "%PID_FILE%" del /f /q "%PID_FILE%" >nul 2>&1
echo [INFO] DocReady stopped cleanly.
timeout /t 2 /nobreak >nul
endlocal
