#!/bin/sh

set -eu

root_path="$(realpath "$(dirname "$0")"/..)"

VERSION_SEMANTIC="minor"
for arg in "$@"; do
    case "$arg" in
        -p|--patch) VERSION_SEMANTIC="patch" ;;
        -m|--minor) VERSION_SEMANTIC="minor" ;;
        -M|--major) VERSION_SEMANTIC="major" ;;
        *)  echo >&2 "Usage: scripts/bump-osrd-schemas-version.sh [-p/--patch] [-m/--minor] [-M/--major] [-h/--help]"
            echo >&2 "Bump osrd-schemas version in its pyproject.toml and all lock files. By default a minor bump is performed." 
            [ "$arg" = "--help" ] || [ "$arg" = "-h" ] || exit 2
            exit 0 ;;
    esac
done

uv --directory "${root_path}"/osrd_schemas version --bump "$VERSION_SEMANTIC"
uv --directory "${root_path}"/tests lock
uv --directory "${root_path}"/python/railjson_generator lock
