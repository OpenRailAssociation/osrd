#!/bin/sh

# For more information on that script, you can have a look at the documentation
# following the link below :
# https://osrd.fr/en/docs/guides/contribute/code-review/#script-for-testing-a-pr

# Note that this script aims at working locally (linux at least) for those cases (manual tests would be nice):
# * the stack alone launched with a database backup
# * the stack alone launched without a database backup
# To compare behaviours:
# * the stack aside an existing "single-worker" stack: `./osrd-compose sw up -d --build`
# * the stack aside an existing regular stack: `docker compose up -d --build`
# Of course:
# * the regular stack and "single-worker" stack should still work alone

set -eu

# For Macos ARM chip users set a postgis image compiled to run on ARM, it makes their DB runs faster as their computer don't have to emulate x86_64's architecture.
case "$(uname -s)" in
    Darwin*) export OSRD_POSTGIS_IMAGE='nickblah/postgis:16-postgis-3';;
    *) :;;
esac

# Usage

if  {
        [ "$#" -eq 3 ] &&
            [ "$2" != "up-and-load-backup" ]
    } ||
    {
        [ "$#" -eq 2 ] &&
            [ "$2" != "up" ]
    } ||
    {
        [ "$#" -eq 1 ] &&
            [ "$1" != "down" ] &&
            [ "$1" != "down-and-clean" ]
    } ||
    {
        [ "$#" -ne 1 ] &&
            [ "$#" -ne 2 ] &&
            [ "$#" -ne 3 ]
    }; then

    echo "Usage: $0 ( [pr-number] (up | up-and-load-backup [osrd.backup]) | down | down-and-clean )" >&2
    exit 1

fi

# Change ports in needed files
export PR_NB="" # We export a blank string for down and down-and-clean options not to produce a warning

if [ "$1" = "down" ]; then

    # Shutdown the docker instance
    docker compose \
        -p "osrd-pr-tests" \
        -f "docker/docker-compose.pr-tests.yml" \
        down

elif [ "$1" = "down-and-clean" ]; then

    # Shutdown and clean the docker instance (remove "osrd" images too)
    osrd_images=$(docker compose \
        -p "osrd-pr-tests" \
        -f "docker/docker-compose.pr-tests.yml" \
        images --format json \
        core editoast osrdyne gateway front \
        | jq --raw-output '.[].ID')

    docker compose \
        -p "osrd-pr-tests" \
        -f "docker/docker-compose.pr-tests.yml" \
        down -v

    # shellcheck disable=SC2086
    docker rmi ${osrd_images}
elif [ "$2" = "up" ] || [ "$2" = "up-and-load-backup" ]; then

    export PR_NB="pr-$1"

    if [ "$2" = "up-and-load-backup" ]; then

        docker compose \
            -p "osrd-pr-tests" \
            -f "docker/docker-compose.pr-tests.yml" \
            up --wait postgres -d

        # Load backup
        export PR_TEST=1
        ./scripts/load-backup.sh "$3"
    fi

    # Load the docker instance
    docker compose \
        -p "osrd-pr-tests" \
        -f "docker/docker-compose.pr-tests.yml" \
        up -d

fi
