@echo off
REM ==============================================================================
REM SpecGuard — Pre-Flight Diagnostic Check (Windows x64 Conda-Pack Deployment)
REM 7-Tier Pre-Flight Deployment Diagnostic Suite
REM Compliant with Rule 06 (Testing & Verification Checklist)
REM ==============================================================================
setlocal enabledelayedexpansion
title SpecGuard - Pre-Flight Check

set "SCRIPT_DIR=%~dp0"
set "ROOT=%SCRIPT_DIR%"
set "ENV_DIR=%ROOT%environment\env"
set "PYTHON_EXE=%ENV_DIR%\python.exe"
set "DATA_DIR=%ROOT%data"

if exist "%ROOT%app\app.py" (
    set "APP_DIR=%ROOT%app"
) else (
    set "APP_DIR=%ROOT%"
)

echo ==============================================================================
echo   SpecGuard — Offline Deployment Pre-Flight Check
echo ==============================================================================
echo   Root Directory: %ROOT%
echo.

set "FAIL_COUNT=0"

REM 1. PACKAGE STRUCTURE
echo 1. PACKAGE STRUCTURE
if exist "%APP_DIR%\app.py" (
    echo   [PASS] Application entry point: app\app.py
) else (
    echo   [FAIL] Application entry point missing: app\app.py
    set /a FAIL_COUNT+=1
)

if exist "%ROOT%environment\specguard-conda.tar.gz" (
    echo   [PASS] Packed environment archive: environment\specguard-conda.tar.gz
) else (
    echo   [WARN] Packed environment archive missing: environment\specguard-conda.tar.gz
)

if exist "%ROOT%START_SPECguard.bat" (
    echo   [PASS] START_SPECguard.bat
) else (
    echo   [FAIL] START_SPECguard.bat missing
    set /a FAIL_COUNT+=1
)

if exist "%ROOT%STOP_SPECguard.bat" (
    echo   [PASS] STOP_SPECguard.bat
) else (
    echo   [FAIL] STOP_SPECguard.bat missing
    set /a FAIL_COUNT+=1
)

if exist "%ROOT%CHECK_SPECguard.bat" (
    echo   [PASS] CHECK_SPECguard.bat
) else (
    echo   [FAIL] CHECK_SPECguard.bat missing
    set /a FAIL_COUNT+=1
)

if exist "%ROOT%verify_environment.py" (
    echo   [PASS] verify_environment.py
) else (
    echo   [FAIL] verify_environment.py missing
    set /a FAIL_COUNT+=1
)

REM 2. ENVIRONMENT
echo.
echo 2. ENVIRONMENT
if exist "%ENV_DIR%" (
    echo   [PASS] Extracted environment present: %ENV_DIR%
) else (
    echo   [INFO] Extracted environment not present yet.
    echo          START_SPECguard.bat will auto-extract from archive on initial launch.
)

if exist "%ENV_DIR%\.unpacked" (
    echo   [PASS] conda-unpack already completed: .unpacked marker verified
) else if exist "%ENV_DIR%\Scripts\conda-unpack.exe" (
    echo   [INFO] conda-unpack.exe ready for relocation
) else (
    echo   [INFO] conda-unpack marker not present yet
)

if exist "%PYTHON_EXE%" (
    "%PYTHON_EXE%" -V >nul 2>&1
    if errorlevel 0 (
        for /f "tokens=*" %%v in ('"%PYTHON_EXE%" -V 2^>^&1') do echo   [PASS] Environment python.exe executes: %%v
    ) else (
        echo   [FAIL] Environment python.exe failed to execute
        set /a FAIL_COUNT+=1
    )
) else (
    if exist "%ROOT%environment\specguard-conda.tar.gz" (
        echo   [INFO] Environment python.exe will be extracted from tarball on first launch.
    ) else (
        echo   [FAIL] No environment and no archive found.
        set /a FAIL_COUNT+=1
    )
)

REM 3. KNOWLEDGE BASES & ASSETS
echo.
echo 3. KNOWLEDGE BASES ^& ASSETS
if exist "%APP_DIR%\rules" (
    echo   [PASS] Engineering rule bases present
) else (
    echo   [FAIL] app\rules directory missing
    set /a FAIL_COUNT+=1
)

if exist "%APP_DIR%\standards" (
    echo   [PASS] Engineering standards present
) else (
    echo   [FAIL] app\standards directory missing
    set /a FAIL_COUNT+=1
)

if exist "%APP_DIR%\templates" (
    echo   [PASS] Document templates present
) else (
    echo   [FAIL] app\templates directory missing
    set /a FAIL_COUNT+=1
)

REM 4. DATA DIRECTORY
echo.
echo 4. DATA DIRECTORY - writable test
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%" 2>nul
echo test_probe > "%DATA_DIR%\.write_test" 2>nul
if exist "%DATA_DIR%\.write_test" (
    del "%DATA_DIR%\.write_test" 2>nul
    echo   [PASS] data\ is writable
) else (
    echo   [FAIL] data\ is not writable
    set /a FAIL_COUNT+=1
)

REM 5. PORT 8765 AVAILABILITY
echo.
echo 5. PORT 8765 AVAILABILITY
netstat -ano | findstr ":8765 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo   [PASS] Port 8765 is available
) else (
    echo   [WARN] Port 8765 is currently in use - SpecGuard may already be running
)

REM 6. RUNTIME IMPORT & NATIVE VERIFICATION
echo.
echo 6. RUNTIME IMPORT VERIFICATION
if exist "%PYTHON_EXE%" (
    set "PYTHONHOME=%ENV_DIR%"
    set "PYTHONPATH=%APP_DIR%"
    set "PATH=%ENV_DIR%;%ENV_DIR%\Library\bin;%ENV_DIR%\Library\mingw-w64\bin;%ENV_DIR%\Library\usr\bin;%ENV_DIR%\Scripts;%ENV_DIR%\bin;%PATH%"
    if exist "%ROOT%verify_environment.py" (
        "%PYTHON_EXE%" "%ROOT%verify_environment.py"
        if errorlevel 1 (
            echo   [FAIL] Native environment verification failed!
            set /a FAIL_COUNT+=1
        ) else (
            echo   [PASS] All core application modules and native probes verified
        )
    )
) else (
    echo   [INFO] Runtime imports will be validated after extraction on first run.
)

REM 7. LIVE SERVICE STATUS
echo.
echo 7. LIVE HTTP SERVICE
curl -s -m 2 http://127.0.0.1:8765/health >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] SpecGuard server is LIVE and responding at http://localhost:8765
) else (
    echo   [INFO] SpecGuard is not currently running. Use START_SPECguard.bat to launch.
)

echo.
echo ==============================================================================
if %FAIL_COUNT% equ 0 (
    echo Pre-flight status: READY FOR STARTUP
) else (
    echo Pre-flight status: FAILED - %FAIL_COUNT% blocker issues detected
)
echo ==============================================================================
echo.
pause
