#!/bin/sh

# This script should be compatible with MSYS, the compatibility layer used by
# Git for Windows. Absolute paths which should not be converted to windows paths
# have to start with //, see https://github.com/git-for-windows/git/issues/1387
# On windows, docker cp does not like leading double / on the container path.
# As a workaround, use relative paths: container:tmp/foo instead of container://tmp/foo

set -eu

if [ "$#" = 0 ]; then
    echo "Missing path to RailJSON rolling stock"
    exit 1
fi

FORCE_OPTION=""
ROLLING_STOCK_PATHS=""
for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
        FORCE_OPTION="--force"
    else
        ROLLING_STOCK_PATHS="$ROLLING_STOCK_PATHS $arg"
    fi
done

echo "Loading $(echo "$ROLLING_STOCK_PATHS" | wc -w) example rolling stock(s)"
for rolling_stock_path in $ROLLING_STOCK_PATHS; do
    docker cp "$rolling_stock_path" osrd-editoast:tmp/stock.json
    # ignore the mandatory "" around $FORCE_OPTION, since "" is interpreted as an arg
    # shellcheck disable=SC2086
    docker exec osrd-editoast editoast import-rolling-stock //tmp/stock.json $FORCE_OPTION
done
