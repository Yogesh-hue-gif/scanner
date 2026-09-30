#!/bin/bash
# ==============================================================================
# SpecGuard — Production Offline Launcher (Conda-Pack / Standalone Python)
# Starts the local FastAPI web server on 0.0.0.0:8765
# ==============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DIR="$SCRIPT_DIR/environment/specguard"
PYTHON_BIN="$ENV_DIR/bin/python"

if [ ! -f "$PYTHON_BIN" ]; then
    if [ -f "$SCRIPT_DIR/environment/specguard-conda.tar.gz" ]; then
        echo "[INFO] Unpacking Conda-Pack environment archive..."
        mkdir -p "$ENV_DIR"
        tar -xzf "$SCRIPT_DIR/environment/specguard-conda.tar.gz" -C "$ENV_DIR"
    elif [ -f "$SCRIPT_DIR/.venv/bin/python" ]; then
        PYTHON_BIN="$SCRIPT_DIR/.venv/bin/python"
    elif command -v python3 >/dev/null 2>&1; then
        PYTHON_BIN="$(command -v python3)"
    else
        echo "[ERROR] No Python runtime found in $ENV_DIR or system PATH."
        exit 1
    fi
fi

if [ -f "$SCRIPT_DIR/app/app.py" ]; then
    APP_DIR="$SCRIPT_DIR/app"
else
    APP_DIR="$SCRIPT_DIR"
fi

export PATH="$ENV_DIR/bin:$PATH"
export SPECGUARD_APP_DIR="$APP_DIR"
export SPECGUARD_DATA_DIR="$SCRIPT_DIR/data"
export SPECGUARD_HOST="0.0.0.0"
export SPECGUARD_PORT=8765

echo "=============================================================================="
echo "  SpecGuard — Engineering Document Quality & Compliance Inspection Platform"
echo "=============================================================================="
echo "[INFO] Starting 100% Offline Web Server..."
echo "[INFO] Local Web UI: http://localhost:8765"
echo "[INFO] LAN Access:   http://0.0.0.0:8765 (access via your machine's LAN IP)"
echo "[INFO] Press Ctrl+C to stop the server."
echo "=============================================================================="

cd "$APP_DIR"
exec "$PYTHON_BIN" app.py --host 0.0.0.0 --port 8765
