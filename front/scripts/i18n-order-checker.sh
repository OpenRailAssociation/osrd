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

if ! jq_version=$(jq --version 2>/dev/null | cut -d- -f2) || [ "$(printf '%s\n%s' "$jq_version" "1.6" | sort -V | head -n1)" != "1.6" ]; then
    echo "Error: jq 1.6 or higher is required. Please install jq 1.6 or higher using your package manager to continue." >&2
    exit 1
fi

JQ_CASE_INSENSITIVE_DEEP_SORT='
def sort_keys_ci:
  to_entries | sort_by(.key | ascii_downcase) | from_entries;

walk(
  if type == "object" then sort_keys_ci else . end
)'

LOCALES_DIR="$(realpath "$(dirname "$0")/../public/locales")"
mapfile -d '' files < <(find "$LOCALES_DIR" -type f -name '*.json' -print0)

UNSORTED=false

for file in "${files[@]}"; do
    sorted=$(jq "$JQ_CASE_INSENSITIVE_DEEP_SORT" "$file") || {
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
