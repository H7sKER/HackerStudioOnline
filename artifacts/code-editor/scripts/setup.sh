#!/bin/bash
# ============================================================
# Code Editor IDE - Developer Setup Script
# ============================================================
# Run once after cloning the repo to set up your environment.
# ============================================================

set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "╔══════════════════════════════════════════╗"
echo "║    Code Editor IDE - Setup               ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Install Node deps
echo "[1/3] Installing dependencies..."
pnpm install

# Check Android SDK
echo "[2/3] Checking Android SDK..."
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "WARNING: ANDROID_HOME not set."
  echo "  Add this to your ~/.bashrc or ~/.zshrc:"
  echo "  export ANDROID_HOME=\$HOME/Android/Sdk"
  echo "  export PATH=\$ANDROID_HOME/platform-tools:\$PATH"
fi

# Expo prebuild
echo "[3/3] Running expo prebuild..."
npx expo prebuild --platform android 2>/dev/null || true

echo ""
echo "Setup complete! Next steps:"
echo "  1. Connect your Android device via USB (USB debugging enabled)"
echo "  2. Run: ./scripts/build-apk.sh"
echo "  OR use GitHub Actions: push to main to build automatically"
echo ""
