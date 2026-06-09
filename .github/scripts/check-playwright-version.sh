#!/bin/sh

# This script checks that the version of the Playwright driver available in nix,
# is coherent with the version of playwright in `front`.

set -e

PLAYWRIGHT_NPM_VERSION=$(cd front/ && npm ls "@playwright/test" --json --package-lock-only | jq --raw-output '.. | .version? // empty')
echo "Version of Playwright in \`package-lock.json\` is '${PLAYWRIGHT_NPM_VERSION}'"
PLAYWRIGHT_NIX_VERSION=$(nix eval --raw '.#playwright-driver.version')
echo "Version of Playwright in the nix flake is '${PLAYWRIGHT_NIX_VERSION}'"

if [ "${PLAYWRIGHT_NPM_VERSION}" = "${PLAYWRIGHT_NIX_VERSION}" ]
then
    echo "Versions of Playwright are the same in \`package-lock.json\` and in the nix flake"
    exit 0
else
    echo "Version of playwright in \`package-lock.json\` (${PLAYWRIGHT_NPM_VERSION}) is incompatible with version of the playwright driver in the nix flake (${PLAYWRIGHT_NIX_VERSION})"
    exit 1
fi
