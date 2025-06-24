#!/bin/sh

set -eu
# This script changes the user and group of the dev server
# process to match the owner of the project's files.
# The development server would otherwise create cache files
# within the source tree which would not be owned by the
# user.

new_uid=$(stat -c %u .)
new_gid=$(stat -c %g .)

# The user that owns the file does not exist in the container,
# as the source tree is mounted from the host. We cannot mirror
# the user, as its UID may already be in use.
# We thus have to pretend the user exists, by creating a home,
# setting the appropriate environment variable, and using
# numerical group and user IDs.

mkdir -p /home/fake_user
chown "${new_uid}:${new_gid}" /home/fake_user
export HOME=/home/fake_user

exec /exec-as "${new_uid}" "${new_gid}" "$@"
