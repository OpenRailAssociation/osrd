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
  editoast user add --skip-if-exists 'E2E No Role' 'e2e/no-role' &&
  editoast user add --skip-if-exists 'E2E Owner' 'e2e/owner' &&
  editoast roles add 'e2e/owner' OperationalStudies Stdcm &&
  editoast user add --skip-if-exists 'E2E Writer' 'e2e/writer' &&
  editoast roles add 'e2e/writer' OperationalStudies Stdcm &&
  editoast user add --skip-if-exists 'E2E Reader' 'e2e/reader' &&
  editoast roles add 'e2e/reader' OperationalStudies Stdcm &&
  editoast user add --skip-if-exists 'E2E Limited' 'e2e/limited' &&
  editoast roles add 'e2e/limited' OperationalStudies Stdcm &&
  editoast user add --skip-if-exists 'E2E Stranger' 'e2e/stranger' &&
  editoast roles add 'e2e/stranger' OperationalStudies Stdcm &&
  editoast user add --skip-if-exists 'E2E Group Member' 'e2e/group-member' &&
  editoast roles add 'e2e/group-member' OperationalStudies &&
  editoast group create 'e2e-group' &&
  editoast group include 'e2e-group' 'e2e/group-member'
"
