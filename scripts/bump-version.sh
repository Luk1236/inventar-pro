#!/usr/bin/env bash
# Bumps the last segment of the VERSION file (e.g. 1.1.1.2 -> 1.1.1.3)
# Usage: bash scripts/bump-version.sh
set -e
FILE="$(dirname "$0")/../VERSION"
VER=$(cat "$FILE" | tr -d '[:space:]')
LAST=${VER##*.}
PREFIX=${VER%.*}
NEW="$PREFIX.$((LAST + 1))"
echo "$NEW" > "$FILE"
echo "Version: $VER -> $NEW"
