#!/usr/bin/env bash
set -euo pipefail

# Usage: ./check-translations-order.sh [--fix]

FIX_MODE=false

if [ "$#" -eq 1 ] && [ "$1" = "--fix" ]; then
    FIX_MODE=true
elif [ "$#" -ne 0 ]; then
    echo "usage: $0 [--fix]" >&2
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required but cannot be found. Please install jq using your package manager to continue." >&2
    exit 1
fi

LOCALES_DIR="$(realpath "$(dirname "$0")/../public/locales")"
mapfile -d '' files < <(find "$LOCALES_DIR" -type f -name '*.json' -print0)

UNSORTED=false

for file in "${files[@]}"; do
    sorted=$(jq -S . "$file") || {
        echo "❌ Failed to parse $file"
        UNSORTED=true
        continue
    }

    if [ "$FIX_MODE" = true ]; then
        printf '%s\n' "$sorted" >"$file"
    elif ! diff -q <(printf '%s\n' "$sorted") -- "$file" >/dev/null; then
        echo "❌ Not sorted: $file"
        UNSORTED=true
    fi
done

if [ "$UNSORTED" = true ]; then
    echo "❗ Some translation files are not sorted."
    exit 1
else
    echo "✅ All translation files are sorted."
fi
