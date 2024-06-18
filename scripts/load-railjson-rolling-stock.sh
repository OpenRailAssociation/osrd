#!/bin/sh

# This script should be compatible with MSYS, the compatibility layer used by
# Git for Windows. Absolute paths which should not be converted to windows paths
# have to start with //, see https://github.com/git-for-windows/git/issues/1387
# On windows, docker cp does not like leading double / on the container path.
# As a workaround, use relative paths: container:tmp/foo instead of container://tmp/foo

set -e

if [ "$#" = 0 ]; then
	echo "Missing path to RailJSON rolling stock"
	exit 1
fi

echo "Loading $# example rolling stock(s)"
for rolling_stock_path in "$@"; do
	docker cp "${rolling_stock_path}" osrd-editoast:tmp/stock.json
	docker exec osrd-editoast editoast import-rolling-stock //tmp/stock.json
done
