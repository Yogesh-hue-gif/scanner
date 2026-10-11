#!/bin/bash
# ==============================================================================
# SpecGuard — Pre-Flight Diagnostic Check (Conda-Pack Deployment)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DIR="$SCRIPT_DIR/environment/env"
PYTHON_BIN="$ENV_DIR/bin/python"

echo "=============================================================================="
echo "  SpecGuard — Pre-Flight Offline Diagnostics"
echo "=============================================================================="

if [ -f "$PYTHON_BIN" ]; then
    echo "[OK] Conda-Pack Python runtime found: $PYTHON_BIN"
    "$PYTHON_BIN" --version
else
    if [ -f "$SCRIPT_DIR/environment/specguard-conda.tar.gz" ]; then
        echo "[INFO] Conda-Pack archive found: $SCRIPT_DIR/environment/specguard-conda.tar.gz"
        echo "[INFO] Archive will be automatically unpacked on first launch by start_specguard.sh."
    elif [ -f "$SCRIPT_DIR/.venv/bin/python" ]; then
        echo "[OK] Local venv Python found: $SCRIPT_DIR/.venv/bin/python"
        "$SCRIPT_DIR/.venv/bin/python" --version
    elif command -v python3 >/dev/null 2>&1; then
        echo "[OK] System Python found: $(command -v python3)"
        python3 --version
    else
        echo "[WARNING] No Python runtime detected."
    fi
fi

if [ -f "$SCRIPT_DIR/app/app.py" ]; then
    APP_DIR="$SCRIPT_DIR/app"
else
    APP_DIR="$SCRIPT_DIR"
fi

if [ -f "$APP_DIR/app.py" ]; then
    echo "[OK] Application core entrypoint verified: $APP_DIR/app.py"
else
    echo "[ERROR] Application entrypoint missing!"
fi

if [ -d "$APP_DIR/models" ]; then
    echo "[OK] Machine learning models directory present."
else
    echo "[ERROR] Models directory missing!"
fi

if [ -d "$APP_DIR/rules" ]; then
    echo "[OK] Engineering rule bases directory present."
else
    echo "[ERROR] Rules directory missing!"
fi

if [ -d "$APP_DIR/standards" ]; then
    echo "[OK] Engineering standards directory present."
else
    echo "[ERROR] Standards directory missing!"
fi

if [ -d "$APP_DIR/templates" ]; then
    echo "[OK] Document templates directory present."
else
    echo "[ERROR] Templates directory missing!"
fi

if [ -d "$SCRIPT_DIR/data" ]; then
    echo "[OK] User persistent data storage present."
else
    echo "[WARNING] Data directory missing, creating..."
    mkdir -p "$SCRIPT_DIR/data"
fi

echo ""
echo "Checking live HTTP service on port 8765..."
curl -s -m 3 http://127.0.0.1:8765/health || echo "[INFO] SpecGuard is not currently running. Use start_specguard.sh to launch."
echo "=============================================================================="
