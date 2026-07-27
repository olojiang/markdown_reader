#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="${SCRIPT_DIR:h}"
cd "$PROJECT_DIR"

echo "[mac] generating icons"
swift scripts/generate-app-icons.swift build/app-icons
rm -rf build/icon.iconset
mkdir -p build/icon.iconset
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" build/app-icons/icon.png --out "build/icon.iconset/icon_${size}x${size}.png" >/dev/null
  next_size=$((size * 2))
  sips -z "$next_size" "$next_size" build/app-icons/icon.png --out "build/icon.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns build/icon.iconset -o build/icon.icns
cp build/app-icons/icon.png build/icon.png

echo "[mac] building unsigned app bundle before ad-hoc signing"
npm run build
rm -rf release/mac
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --x64 --dir --publish never

APP_PATH="$PROJECT_DIR/release/mac/Markdown Reader.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "[mac] app bundle was not produced: $APP_PATH" >&2
  exit 1
fi

echo "[mac] ad-hoc signing $APP_PATH"
codesign --deep --force --verbose --sign - "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

VERSION=$(node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version")
DMG_PATH="$PROJECT_DIR/release/Markdown Reader-$VERSION-mac-x64-adhoc.dmg"
rm -f "$DMG_PATH"
hdiutil create -volname "Markdown Reader" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH" >/dev/null

echo "[mac] signed app: $APP_PATH"
echo "[mac] disk image: $DMG_PATH"
