#!/bin/sh

# This script should be used to generate signaling systems atlas given svg.
# First add all your svg in a subfolder named to the signaling system (eg: `BAL`)
# Then run this script. You will need docker.

for signaling_system in $(ls); do
  # Skip files (like this file)
  [ ! -d "${signaling_system}" ] && continue

  # Prepare the tmp directory
  tmp_dir="$(mktemp -d)"
  echo "Generating '${signaling_system}' at '${tmp_dir}'..."
  svg_dir="${tmp_dir}/sprites/svg/"
  mkdir -p "${svg_dir}"
  cp "${signaling_system}"/*.svg "${svg_dir}"

  # Generate atlas
  docker run -it -e FOLDER=svg -e THEME=sprites -v "${tmp_dir}:/data" dolomate/spritezero
  cp "${tmp_dir}"/sprites/sprites* "${signaling_system}"

  # Add a linefeed to the json files
  for json_file in $(ls  "${signaling_system}"/*.json); do
    echo "" >> "${json_file}"
  done

  echo "${signaling_system} atlas generated"

  # Cleaning up
  echo "Cleaning ${tmp_dir}..."
  rm -rf "${tmp_dir}"
done
