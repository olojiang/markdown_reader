#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
RELEASE_DIR="$SCRIPT_DIR/release"

if [[ "$RELEASE_DIR" != "$SCRIPT_DIR/release" || ! -d "$SCRIPT_DIR" ]]; then
  echo "Refusing to clean an unexpected release path: $RELEASE_DIR" >&2
  exit 1
fi

mkdir -p "$RELEASE_DIR"
find "$RELEASE_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
echo "Cleaned $RELEASE_DIR"
