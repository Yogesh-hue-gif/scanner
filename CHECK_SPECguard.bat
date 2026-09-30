@echo off
REM ==============================================================================
REM SpecGuard — Pre-Flight Diagnostic Check (Windows x64 Conda-Pack Deployment)
REM Validates runtime, native dependencies, model files, rules, standards,
REM templates, frontend assets, OCR subsystem, and SQLite database storage.
REM ==============================================================================

setlocal enabledelayedexpansion
set SCRIPT_DIR=%~dp0
set ENV_DIR=%SCRIPT_DIR%environment\specguard
set PYTHON_EXE=%ENV_DIR%\python.exe

echo ==============================================================================
echo   SpecGuard — Windows x64 Offline Pre-Flight System Diagnostic
echo ==============================================================================

REM 1. Unpack Conda-Pack environment if not already unpacked
if not exist "%PYTHON_EXE%" (
    if exist "%SCRIPT_DIR%environment\specguard-conda.tar.gz" (
        echo [INFO] Conda-Pack environment archive detected: specguard-conda.tar.gz
        echo [INFO] Unpacking portable Python runtime to: %ENV_DIR%
        mkdir "%ENV_DIR%" 2>nul
        tar -xzf "%SCRIPT_DIR%environment\specguard-conda.tar.gz" -C "%ENV_DIR%"
    ) else (
        echo [INFO] Checking system PATH for Python...
        for /f "tokens=*" %%i in ('where python 2^>nul') do (
            if not defined PYTHON_EXE set PYTHON_EXE=%%i
        )
    )
)

REM 2. Execute deep diagnostic suite using Python
if exist "%PYTHON_EXE%" (
    echo [OK] Using Python Runtime: %PYTHON_EXE%
    echo.
    if exist "%SCRIPT_DIR%check_specguard.py" (
        "%PYTHON_EXE%" "%SCRIPT_DIR%check_specguard.py"
        goto :LIVE_CHECK
    ) else if exist "%SCRIPT_DIR%app\check_specguard.py" (
        "%PYTHON_EXE%" "%SCRIPT_DIR%app\check_specguard.py"
        goto :LIVE_CHECK
    )
)

echo [WARNING] Python executable not found or diagnostic script missing.
echo Running basic file checks...

if exist "%SCRIPT_DIR%app\app.py" (
    echo [OK] Application core entrypoint verified: %SCRIPT_DIR%app\app.py
) else (
    echo [ERROR] Application entrypoint missing!
)

if exist "%SCRIPT_DIR%app\models" (
    echo [OK] Machine learning models directory present.
) else (
    echo [ERROR] Models directory missing!
)

if exist "%SCRIPT_DIR%app\rules" (
    echo [OK] Engineering rule bases directory present.
) else (
    echo [ERROR] Rules directory missing!
)

if exist "%SCRIPT_DIR%app\standards" (
    echo [OK] Engineering standards directory present.
) else (
    echo [ERROR] Standards directory missing!
)

if exist "%SCRIPT_DIR%app\templates" (
    echo [OK] Document templates directory present.
) else (
    echo [ERROR] Templates directory missing!
)

if exist "%SCRIPT_DIR%data" (
    echo [OK] User persistent data storage present.
) else (
    echo [WARNING] Data directory missing, creating...
    mkdir "%SCRIPT_DIR%data" 2>nul
)

:LIVE_CHECK
echo.
echo Checking live HTTP service on port 8765...
curl -s -m 3 http://127.0.0.1:8765/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] SpecGuard server is LIVE and responding at http://localhost:8765
) else (
    echo [INFO] SpecGuard is not currently running. Use START_SPECguard.bat to launch.
)
echo ==============================================================================
pause
