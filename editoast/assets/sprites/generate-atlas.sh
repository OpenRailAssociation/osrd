#!/bin/sh

# This script should be used to generate signaling systems atlas given svg.
# First add all your svg in a subfolder named to the signaling system (eg: `BAL`)
# Then run this script. You will need docker.
set -eu

sprites_directory=$(dirname "$(realpath "$0")")
echo "Processing sprites in ${sprites_directory}"
for signaling_system in "${sprites_directory}"/*; do
  # Skip files (like this file)
  [ -d "${signaling_system}" ] || continue

  # Generate atlas
  spreet "${signaling_system}" "${signaling_system}"/sprites
  spreet --ratio=2 "${signaling_system}" "${signaling_system}"/sprites@2x
  spreet --ratio=3 "${signaling_system}" "${signaling_system}"/sprites@3x

  # Add a linefeed to the json files
  for json_file in "${signaling_system}"/*.json; do
    [ -f "$json_file" ] || continue
    echo "" >> "${json_file}"
  done

  echo "${signaling_system} atlas generated"
done
