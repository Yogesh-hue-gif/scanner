#!/bin/bash
# ==============================================================================
# SpecGuard — Production Offline Stop Script
# ==============================================================================

echo "Stopping SpecGuard process listening on port 8765..."
PID=$(lsof -ti :8765 2>/dev/null || true)
if [ -n "$PID" ]; then
    kill -9 $PID
    echo "Terminated SpecGuard process PID: $PID"
else
    echo "No SpecGuard process found running on port 8765."
fi
