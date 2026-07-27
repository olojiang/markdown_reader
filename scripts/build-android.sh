#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="${SCRIPT_DIR:h}"
GRADLE_TASK="${1:-assembleRelease}"

if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
  if command -v brew >/dev/null 2>&1; then
    jdk_prefix=$(brew --prefix openjdk@21 2>/dev/null || true)
    if [[ -x "$jdk_prefix/libexec/openjdk.jdk/Contents/Home/bin/java" ]]; then
      export JAVA_HOME="$jdk_prefix/libexec/openjdk.jdk/Contents/Home"
    fi
  fi
fi

if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "Android build requires JDK 21. Set JAVA_HOME or install Homebrew openjdk@21." >&2
  exit 1
fi

java_version=$("$JAVA_HOME/bin/java" -version 2>&1 | sed -n '1s/.*version "\([0-9]*\).*/\1/p')
if [[ "$java_version" != "21" ]]; then
  echo "Android build requires JDK 21, found Java $java_version at $JAVA_HOME" >&2
  exit 1
fi

cd "$PROJECT_DIR"
npm run android:sync
(cd android && ./gradlew "$GRADLE_TASK")
