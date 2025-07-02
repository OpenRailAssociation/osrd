#!/bin/sh

set -eu

if [ "$#" != 1 ]; then
  echo "usage: $0 <version>"
  exit 1
fi

version="$1"

# Update ui-* dependency version numbers
for f in ui/*/package.json; do
  jq ".dependencies = (
    (.dependencies // {}) | with_entries(
      if .key | startswith(\"@osrd-project/ui-\") then
        .value = \"$version\"
      end
    )
  )" "$f" >"$f.new"
  mv "$f.new" "$f"
done

npm version "$version" --workspaces --git-tag-version=false
npm publish --workspaces
