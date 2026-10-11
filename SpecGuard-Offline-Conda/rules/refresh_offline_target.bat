@echo off
REM ==============================================================================
REM  SpecGuard - Offline Environment Refresh & Cache Buster
REM  RUN ON THE AIR-GAPPED TARGET MACHINE WHEN DEPLOYING A NEW TARBALL
REM ==============================================================================
setlocal EnableDelayedExpansion
title SpecGuard - Refresh Offline Environment

set "SCRIPT_DIR=%~dp0"
set "ROOT=%SCRIPT_DIR%..\.."
pushd "%ROOT%"
set "ROOT=%CD%"
popd

set "ENV_DIR=%ROOT%\environment\env"
set "TARBALL=%ROOT%\environment\specguard-conda.tar.gz"

echo ==============================================================================
echo   SpecGuard - Offline Environment Refresh Tool
echo ==============================================================================
echo   Root: %ROOT%
echo.

REM 1. Stop Server
if exist "%ROOT%\STOP_SPECguard.bat" (
    echo [1/3] Ensuring server is stopped...
    call "%ROOT%\STOP_SPECguard.bat" >nul 2>&1
)

REM 2. Verify Tarball Exists
if not exist "%TARBALL%" (
    echo [FAIL] New environment archive not found:
    echo        %TARBALL%
    echo        Please copy the new specguard-conda.tar.gz into environment\ first.
    pause
    exit /b 1
)

REM 3. Purge Cached Environment
echo [2/3] Removing old extracted environment (cache busting)...
if exist "%ENV_DIR%" (
    rmdir /s /q "%ENV_DIR%"
    if exist "%ENV_DIR%" (
        echo [WARN] Could not completely delete %ENV_DIR%.
        echo        A process may still be holding a lock. Close any command prompts
        echo        or applications and retry.
        pause
        exit /b 1
    )
    echo [OK] Old extracted environment wiped.
) else (
    echo [OK] No old extracted environment found.
)

echo [3/3] Ready for fresh extraction!
echo.
echo ==============================================================================
echo   REFRESH PREPARATION COMPLETE!
echo ==============================================================================
echo   When you run START_SPECguard.bat:
echo     1. It will detect the clean state.
echo     2. Extract the new specguard-conda.tar.gz archive.
echo     3. Run conda-unpack to relocate binary and script paths.
echo     4. Start the application with your upgraded packages.
echo ==============================================================================
echo.
set /p CHOICE="Do you want to start SpecGuard now? (Y/N): "
if /i "%CHOICE%"=="Y" (
    call "%ROOT%\START_SPECguard.bat"
)
exit /b 0
