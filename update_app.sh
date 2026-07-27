#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="$SCRIPT_DIR"
APP_NAME="Markdown Reader"
BUILT_APP="$PROJECT_DIR/release/mac/$APP_NAME.app"
INSTALL_APP="/Applications/$APP_NAME.app"
PROCESS_PATH="$INSTALL_APP/Contents/MacOS/$APP_NAME"
PROCESS_PATTERN="$APP_NAME.app/Contents/MacOS/$APP_NAME"

cd "$PROJECT_DIR"
echo "[update] build and ad-hoc sign"
scripts/build-mac-adhoc.sh

echo "[update] stop existing app if running"
pkill -f "$PROCESS_PATTERN" 2>/dev/null || true
for _ in {1..20}; do
  if ! pgrep -f "$PROCESS_PATTERN" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done
if pgrep -f "$PROCESS_PATTERN" >/dev/null 2>&1; then
  echo "[update] existing process did not exit: $PROCESS_PATH" >&2
  exit 1
fi

echo "[update] install to $INSTALL_APP"
if [[ -d "$INSTALL_APP" ]]; then
  rm -rf "$INSTALL_APP"
fi
ditto "$BUILT_APP" "$INSTALL_APP"

echo "[update] verify installed signature"
codesign --verify --deep --strict --verbose=2 "$INSTALL_APP"

echo "[update] launch installed app"
open "$INSTALL_APP"
for _ in {1..20}; do
  if pgrep -f "$PROCESS_PATH" >/dev/null 2>&1; then
    echo "[update] Markdown Reader is running from /Applications"
    exit 0
  fi
  sleep 0.5
done

echo "[update] app did not start: $PROCESS_PATH" >&2
exit 1
