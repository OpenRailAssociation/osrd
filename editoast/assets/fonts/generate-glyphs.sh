#!/bin/sh

# This script should be used to generate glyphs from ttf fonts.
# Those glyphs are used to display text on the map
# You will need build_pbf_glyphs, you can install it with:
# `$ cargo install build_pbf_glyphs`
set -eu

fonts_directory=$(dirname "$(realpath "$0")")
echo "Converting fonts in ${fonts_directory} to glyphs"
build_pbf_glyphs "${fonts_directory}" "${fonts_directory}"/glyphs/
