#!/bin/sh

>/tmp/front_config jq -rn '{
    OSRD_GIT_DESCRIBE: env.OSRD_GIT_DESCRIBE,
} | @json | "      globalThis.import_meta_env = \(.);"'

sed -i -e '/import_meta_env_placeholder/ {
    r /tmp/front_config
    d
}' /srv/front/index.html

update-ca-certificates

exec "$@"
