#!/bin/bash
# ============================================================
# Code Editor IDE - Bootstrap Package Installer
# ============================================================
# This script downloads and sets up the bootstrap Linux packages
# (bash, coreutils, python, git, etc.) into the app's private
# storage so the integrated terminal has a full Linux environment.
#
# Run this inside the terminal panel on your device, OR use
# BootstrapInstaller.kt which calls this automatically on first launch.
# ============================================================

set -euo pipefail

APP_DATA="/data/data/com.vscodemobile.ide/files"
PREFIX="$APP_DATA/usr"
HOME_DIR="$APP_DATA/home"
TMP_DIR="$APP_DATA/tmp"
STAGING="$APP_DATA/usr-staging"
BOOTSTRAP_URL_BASE="https://github.com/termux/termux-packages/releases/latest/download"

# Detect device ABI
ABI=$(getprop ro.product.cpu.abi 2>/dev/null || echo "arm64-v8a")
case "$ABI" in
  arm64-v8a)  BOOTSTRAP_ZIP="bootstrap-aarch64.zip" ;;
  armeabi-v7a) BOOTSTRAP_ZIP="bootstrap-arm.zip" ;;
  x86_64)      BOOTSTRAP_ZIP="bootstrap-x86_64.zip" ;;
  x86)         BOOTSTRAP_ZIP="bootstrap-i686.zip" ;;
  *)           BOOTSTRAP_ZIP="bootstrap-aarch64.zip" ;;
esac

BOOTSTRAP_URL="$BOOTSTRAP_URL_BASE/$BOOTSTRAP_ZIP"

echo "============================================="
echo "  Code Editor IDE - Bootstrap Setup"
echo "============================================="
echo "ABI: $ABI"
echo "Bootstrap: $BOOTSTRAP_ZIP"
echo ""

# Check if already installed
if [ -f "$PREFIX/bin/bash" ]; then
    echo "[OK] Bootstrap already installed at $PREFIX"
    echo "     To reinstall, delete $PREFIX and re-run this script."
    exit 0
fi

# Create directories
echo "[1/5] Creating directory structure..."
mkdir -p "$PREFIX" "$HOME_DIR" "$TMP_DIR" "$STAGING"

# Download bootstrap ZIP
TMPZIP="$TMP_DIR/$BOOTSTRAP_ZIP"
echo "[2/5] Downloading $BOOTSTRAP_ZIP..."
echo "      URL: $BOOTSTRAP_URL"

if command -v curl &>/dev/null; then
    curl -L --progress-bar -o "$TMPZIP" "$BOOTSTRAP_URL"
elif command -v wget &>/dev/null; then
    wget -q --show-progress -O "$TMPZIP" "$BOOTSTRAP_URL"
else
    echo "ERROR: Neither curl nor wget found. Cannot download bootstrap."
    exit 1
fi

echo "[3/5] Extracting bootstrap..."
cd "$STAGING"
unzip -q "$TMPZIP" || {
    echo "ERROR: Failed to extract $TMPZIP"
    exit 1
}

# Process SYMLINKS.txt
echo "[4/5] Creating symlinks..."
if [ -f "$STAGING/SYMLINKS.txt" ]; then
    while IFS= read -r line; do
        src=$(echo "$line" | cut -d'←' -f1)
        dst="$PREFIX/$(echo "$line" | cut -d'←' -f2)"
        mkdir -p "$(dirname "$dst")"
        ln -sf "$src" "$dst" 2>/dev/null || true
    done < "$STAGING/SYMLINKS.txt"
    rm "$STAGING/SYMLINKS.txt"
fi

# Move staging to prefix
echo "[5/5] Installing to $PREFIX..."
cp -a "$STAGING/." "$PREFIX/"
rm -rf "$STAGING" "$TMPZIP"

# Set executable permissions
chmod -R u+x "$PREFIX/bin/" 2>/dev/null || true
chmod -R u+x "$PREFIX/libexec/" 2>/dev/null || true

# Create ~/.bashrc
cat > "$HOME_DIR/.bashrc" << 'BASHRC'
export HOME=/data/data/com.vscodemobile.ide/files/home
export PREFIX=/data/data/com.vscodemobile.ide/files/usr
export PATH=$PREFIX/bin:$PREFIX/sbin:/system/bin:/system/xbin
export TMPDIR=/data/data/com.vscodemobile.ide/files/tmp
export TERM=xterm-256color
export COLORTERM=truecolor
export LANG=en_US.UTF-8
export PS1='\[\033[1;32m\]\u@code-editor\[\033[0m\]:\[\033[1;34m\]\w\[\033[0m\]\$ '
alias ls='ls --color=auto'
alias ll='ls -la'
alias la='ls -A'
BASHRC

# Create ~/.profile
cat > "$HOME_DIR/.profile" << 'PROFILE'
[ -f "$HOME/.bashrc" ] && source "$HOME/.bashrc"
PROFILE

echo ""
echo "============================================="
echo "  Bootstrap installed successfully!"
echo "  Shell: $PREFIX/bin/bash"
echo "  Home:  $HOME_DIR"
echo ""
echo "  Start a new terminal session to use bash."
echo "============================================="
