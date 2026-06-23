#!/bin/bash
# ============================================================
# Code Editor IDE - Complete Build Script
# ============================================================
# Builds a debug APK you can sideload on your Android device.
# 
# Requirements:
#   - Node.js >= 18, pnpm
#   - Java 17 (JDK)
#   - Android SDK (ANDROID_HOME set)
#   - npx expo installed
#
# Usage:
#   chmod +x scripts/build-apk.sh
#   ./scripts/build-apk.sh
# ============================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║    Code Editor IDE - APK Builder         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# --- Check prerequisites ---
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "ERROR: '$1' not found. Please install it first."
    exit 1
  fi
}

check_cmd node
check_cmd java
check_cmd pnpm

if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: ANDROID_HOME is not set."
  echo "       Set it to your Android SDK directory, e.g.:"
  echo "       export ANDROID_HOME=\$HOME/Android/Sdk"
  exit 1
fi

echo "[1/5] Checking Java version..."
java -version 2>&1 | head -1
JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d. -f1)
if [ "$JAVA_VER" -lt 17 ] 2>/dev/null; then
  echo "WARNING: Java 17+ recommended (found Java $JAVA_VER)"
fi

echo "[2/5] Installing Node.js dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "[3/5] Generating Expo prebuild (Android)..."
npx expo prebuild --platform android --clean 2>/dev/null || {
  echo "  (prebuild already done, skipping)"
}

echo "[4/5] Building debug APK..."
cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon --warning-mode none 2>&1 | tail -20

cd "$PROJECT_ROOT"

APK_PATH=$(find android -name "*.apk" -path "*/debug/*" | head -1)
if [ -n "$APK_PATH" ]; then
  echo ""
  echo "╔══════════════════════════════════════════╗"
  echo "║    BUILD SUCCESSFUL                      ║"
  echo "╠══════════════════════════════════════════╣"
  echo "║  APK: $APK_PATH"
  echo "╚══════════════════════════════════════════╝"
  echo ""
  echo "[5/5] Install on connected device? (y/N)"
  read -r INSTALL
  if [[ "$INSTALL" =~ ^[Yy]$ ]]; then
    ADB="${ANDROID_HOME}/platform-tools/adb"
    if command -v adb &>/dev/null; then ADB=adb; fi
    "$ADB" install -r "$APK_PATH"
    echo "Installed! Launch 'Code Editor IDE' on your device."
  fi
else
  echo "ERROR: APK not found. Check the gradle output above."
  exit 1
fi
