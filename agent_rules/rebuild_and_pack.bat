@echo off
REM ==============================================================================
REM  SpecGuard - Automated Build, Verification & Conda-Pack Packaging Tool
REM  RUN ON ONLINE WINDOWS x64 BUILD HOST ONLY
REM ==============================================================================
setlocal EnableDelayedExpansion
title SpecGuard - Build & Pack Offline Environment

set "SCRIPT_DIR=%~dp0"
set "ROOT=%SCRIPT_DIR%..\.."
pushd "%ROOT%"
set "ROOT=%CD%"
popd

echo ==============================================================================
echo   SpecGuard - Automated Offline Conda Environment Builder
echo ==============================================================================
echo   Root Directory: %ROOT%
echo   Build Host OS : %OS% (Target: Windows x64)
echo.

if not exist "%ROOT%\environment.yml" (
    echo [ERROR] environment.yml not found in %ROOT%
    pause
    exit /b 1
)

REM 1. Check Conda
where conda >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 'conda' command not found in PATH.
    echo         Please run this from Anaconda Prompt or add Conda to PATH.
    pause
    exit /b 1
)

REM 2. Create or Update Environment
echo [1/5] Updating/Creating Conda environment 'specguard' from environment.yml...
call conda env update -n specguard -f "%ROOT%\environment.yml" --prune
if errorlevel 1 (
    echo [ERROR] Conda environment update failed.
    pause
    exit /b 1
)

REM 3. Activate and verify conda-pack
echo [2/5] Activating environment and verifying packaging tools...
call conda activate specguard
if errorlevel 1 (
    echo [ERROR] Could not activate conda environment 'specguard'.
    pause
    exit /b 1
)

call conda list conda-pack | findstr "conda-pack" >nul 2>&1
if errorlevel 1 (
    echo [NOTICE] conda-pack not found inside env. Installing from conda-forge...
    call conda install -n specguard -c conda-forge conda-pack -y
    if errorlevel 1 (
        echo [ERROR] Failed to install conda-pack.
        pause
        exit /b 1
    )
)

REM 4. Run Verification Suite
echo [3/5] Running verify_environment.py in-situ...
python "%ROOT%\verify_environment.py"
if errorlevel 1 (
    echo [FAIL] Environment verification failed! Package contains broken dependencies.
    echo        Aborting conda-pack to prevent shipping a broken environment.
    pause
    exit /b 1
)

REM 5. Run conda-pack
echo [4/5] Archiving environment with conda-pack...
if not exist "%ROOT%\environment" mkdir "%ROOT%\environment"
set "TARBALL=%ROOT%\environment\specguard-conda.tar.gz"

call conda pack -n specguard -o "%TARBALL%" --ignore-missing-files --force
if errorlevel 1 (
    echo [FAIL] conda-pack failed!
    pause
    exit /b 1
)
echo [OK] Packed archive generated: %TARBALL%

REM 6. Lockfile and Checksums
echo [5/5] Updating lockfile and checksums...
call conda list -n specguard --json > "%ROOT%\pkgs.json" 2>nul
python -m pip list --format=json > "%ROOT%\pip.json" 2>nul

if exist "%ROOT%\make_lockfile.py" (
    python "%ROOT%\make_lockfile.py"
)
if exist "%ROOT%\make_checksums.py" (
    python "%ROOT%\make_checksums.py"
)

del "%ROOT%\pkgs.json" "%ROOT%\pip.json" >nul 2>&1

echo.
echo ==============================================================================
echo   BUILD AND PACKAGING COMPLETE!
echo ==============================================================================
echo   The updated environment is ready at:
echo     %TARBALL%
echo.
echo   TO DEPLOY TO AIR-GAPPED TARGET:
echo     1. Transfer %TARBALL% to the offline machine.
echo     2. On the offline machine, run rules\scripts\refresh_offline_target.bat
echo     3. Run START_SPECguard.bat
echo ==============================================================================
echo.
pause
exit /b 0
