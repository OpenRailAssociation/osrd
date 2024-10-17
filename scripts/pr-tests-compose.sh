#!/bin/sh

# For more information on that script, you can have a look at the documentation
# following the link below :
# https://osrd.fr/en/docs/guides/contribute/code-review/#script-for-testing-a-pr


set -e

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
        {   [ "$2" != "up" ] &&
            [ "$2" != "down" ] &&
            [ "$2" != "down-and-clean" ]
        }
    }; then

    echo "Usage: $0 pr-number (up | up-and-load-backup [osrd.backup] | down | down-and-clean )" >&2
    exit 1

fi

# Change ports in needed files
export PR_NB="pr-$1"

if [ "$2" = "up" ] || [ "$2" = "up-and-load-backup" ]; then

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

elif [ "$2" = "down" ]; then

    # Shutdown the docker instance
    docker compose \
        -p "osrd-pr-tests" \
        -f "docker/docker-compose.pr-tests.yml" \
        down

else

    # Shutdown and clean the docker instance
    docker compose \
        -p "osrd-pr-tests" \
        -f "docker/docker-compose.pr-tests.yml" \
        down -v

fi
