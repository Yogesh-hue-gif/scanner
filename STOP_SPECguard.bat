@echo off
REM ==============================================================================
REM SpecGuard — Production Offline Stop Script
REM ==============================================================================

echo Stopping SpecGuard process listening on port 8765...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 ^| findstr LISTENING') do (
    taskkill /f /pid %%a 2>nul
    echo Terminated process PID: %%a
)
echo SpecGuard stopped.
