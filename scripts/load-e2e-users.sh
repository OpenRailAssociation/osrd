#!/bin/sh

# Create the users impersonated by the front end-to-end permission tests.
# Their names are declared in front/tests/assets/constants/permission-const.ts.
# The script can be run several times: existing users are skipped.
#

set -eu

editoast_container="${1:-osrd-editoast}"

echo "Creating e2e users in $editoast_container"
docker exec "${editoast_container}" sh -c "
  editoast user add --skip-if-exists 'E2E Project Outsider' 'e2e/project-outsider' &&
  editoast roles add 'e2e/project-outsider' OperationalStudies &&
  editoast user add --skip-if-exists 'E2E Stdcm Only' 'e2e/stdcm-only' &&
  editoast roles add 'e2e/stdcm-only' Stdcm &&
  editoast user add --skip-if-exists 'E2E No Role' 'e2e/no-role'
"
