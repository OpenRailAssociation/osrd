#!/usr/bin/env bash

# args contains the argument to the bake metadata generation script
args=()

# the image pattern is used to deduce image name from container name
image_pattern='ghcr.io/osrd-project/unstable/osrd-{container}'
args+=(--image-pattern "$image_pattern")

# get the list of containers
containers=$(sed -En 's/^target\s+"base-([a-z-]*)"\s*\{\s*\}$/\1/p' < docker/docker-bake.hcl)
for container in $containers; do
    args+=("--container" "$container")
done

is_protected_branch() {
    case "$target_ref" in
        dev|staging|prod) true;;
        *) false;;
    esac
}

cache_from() {
    printf "type=registry,mode=max,ref=%s" "$1"
}

cache_to() {
    cache_from "$1"
    printf ",compression=zstd"
}

# if we're on a pull request
if [ -n "$GITHUB_BASE_REF" ]; then
    target_ref="$GITHUB_BASE_REF"
    pr_id="${GITHUB_REF%/merge}"
    pr_id="${pr_id#refs/pull/}"
    pr_cache_pat="${image_pattern}:pr-${pr_id}-cache"
    args+=(--cache-to-pattern   "$(cache_to   "${pr_cache_pat}")")
    args+=(--cache-from-pattern "$(cache_from "${pr_cache_pat}")")

    target_ref="$GITHUB_BASE_REF"
    if is_protected_branch "$target_ref"; then
        target_cache_pat="${image_pattern}:${target_ref}-cache"
        args+=(--cache-from-pattern "$(cache_from "${target_cache_pat}")")
    fi
# we're on dev, staging or prod
elif [ "$GITHUB_REF_PROTECTED" = 'true' ]; then
    ref_cache_pat="${image_pattern}:${GITHUB_REF_NAME}-cache"
    args+=(--cache-to-pattern   "$(cache_to   "${ref_cache_pat}")")
    args+=(--cache-from-pattern "$(cache_from "${ref_cache_pat}")")
fi

exec "$(dirname "$0")"/bake-metadata.py "${args[@]}" 'base-{container}' "$@"
