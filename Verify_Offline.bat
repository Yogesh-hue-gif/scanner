@echo off
setlocal enabledelayedexpansion

title DocReady — Offline Acceptance ^& Diagnostics Suite
echo ===============================================================================
echo          DOCREADY OFFLINE ACCEPTANCE ^& DIAGNOSTICS TEST
echo ===============================================================================
echo.

set "INSTALL_DIR=%~dp0"
if "%INSTALL_DIR:~-1%"=="\" set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
cd /d "%INSTALL_DIR%"

:: 1. Strict Bundled Python Resolution
set "RUNTIME_DIR=%INSTALL_DIR%\runtime"
set "PYTHON_EXE=%RUNTIME_DIR%\python.exe"

if not exist "%PYTHON_EXE%" (
    :: In dev workspace without extracted runtime, check if specguard conda env exists for dev testing
    if exist "C:\Users\%USERNAME%\anaconda3\envs\specguard\python.exe" (
        set "PYTHON_EXE=C:\Users\%USERNAME%\anaconda3\envs\specguard\python.exe"
        echo [INFO] Running in development mode using active specguard env.
    ) else (
        echo [ERROR] Bundled Python runtime not found at: %PYTHON_EXE%
        echo The production acceptance test requires the bundled Conda-Pack runtime.
        pause
        exit /b 1
    )
) else (
    echo [INFO] Using packaged runtime: %RUNTIME_DIR%
    set "PATH=%RUNTIME_DIR%;%RUNTIME_DIR%\Library\bin;%RUNTIME_DIR%\Scripts;%RUNTIME_DIR%\Library\usr\bin;%RUNTIME_DIR%\Library\mingw-w64\bin;%PATH%"
    set "PYTHONHOME=%RUNTIME_DIR%"
)

set "PYTHONPATH=%INSTALL_DIR%"
set "DOCREADY_ROOT=%INSTALL_DIR%"

:: 2. Execute 14-Point Offline Acceptance Suite
"%PYTHON_EXE%" verify_offline.py
set "TEST_EXIT_CODE=%ERRORLEVEL%"

if %TEST_EXIT_CODE% equ 0 (
    echo.
    echo [SUCCESS] Offline verification completed with 0 errors.
    echo Application meets 100%% of offline air-gapped readiness requirements.
) else (
    echo.
    echo [FAILURE] One or more offline acceptance checks failed.
    echo Please review failure outputs above.
)

exit /b %TEST_EXIT_CODE%
