#!/bin/sh

set -e

OUTPUT_DIR="."
if [ "$#" -eq 1 ]; then
  OUTPUT_DIR="$(readlink -f $1)/"
fi

# Check output directory
if [ ! -d "$OUTPUT_DIR" ]; then
  echo "usage: $0 [OUTPUT_DIR]"
  exit 1
fi

# Generating the backup
echo "Generating the backup... (it can take some time)"
docker exec osrd-postgres pg_dump -d osrd -F c -Z 9 -f /tmp/osrd.backup > /dev/null

# Get metadata
echo Collecting backup information...
SHA1=$(docker exec osrd-postgres sha1sum /tmp/osrd.backup | cut -d' ' -f1)
SIZE=$(docker exec osrd-postgres du -sh /tmp/osrd.backup | cut -f1)
echo "  sha1: ${SHA1}"
echo "  size: ${SIZE}"

DATE=$(date "+%G_%m_%d")

FILE_PATH="${OUTPUT_DIR}/osrd_${DATE}_sha1_${SHA1}.backup"
docker cp osrd-postgres:/tmp/osrd.backup "${FILE_PATH}"
echo "Your backup is ready here: '${FILE_PATH}'"
