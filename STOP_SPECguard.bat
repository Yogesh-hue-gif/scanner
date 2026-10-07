@echo off
REM ==============================================================================
REM SpecGuard — Production Offline Stop Script
REM ==============================================================================
setlocal enabledelayedexpansion

echo Stopping SpecGuard process listening on port 8765...
set "KILLED=0"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 ^| findstr LISTENING') do (
    taskkill /f /pid %%a 2>nul
    echo Terminated process PID: %%a
    set "KILLED=1"
)

if "%KILLED%"=="0" (
    echo No active process found listening on port 8765.
) else (
    echo SpecGuard stopped successfully.
)

if exist "%~dp0data\specguard.pid" (
    del "%~dp0data\specguard.pid" 2>nul
)
