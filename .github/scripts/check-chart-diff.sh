#!/bin/sh

set -e

HELM_DOCS_CMD="helm-docs --chart-search-root=chart --output-file=./README.md --template-files=./README.md.gotmpl"

$HELM_DOCS_CMD

if git diff --quiet; then
    echo "Chart documentation is up to date"
    exit 0
fi

echo "Changes in the chart documentation are not up to date in the DOCS.md."
echo "Please run '$HELM_DOCS_CMD' to update it."
exit 1
