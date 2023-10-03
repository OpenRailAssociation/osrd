#!/usr/bin/env bash

# gh cli is buggy as of the writing of this script, and wants both
# of these environment variables to understand it's a script
export CLICOLOR=0 CLICOLOR_FORCE=0

: ${ORG:=osrd-project}
: ${RETENTION_PERIOD_DAYS:=30}
: ${PACKAGE_FILTER_REGEX:='.*'}  # this regex matches everything
: ${EXCLUDE_TAGS_REGEX:='^\b$'}  # this regex never matches anything

# Define the retention period in milliseconds (30 days in this case)
retention_period_seconds=$((RETENTION_PERIOD_DAYS * 24 * 60 * 60))

# The threshold time for package version deletion
retention_threshold=$(($(date +%s) - retention_period_seconds))

select_packages() {
    jq 'map(select(.name | test($regex_filter)))' --arg regex_filter "$1"
}

# packages ORG [PACKAGE-TYPE]
packages() {
    gh api "orgs/$1/packages?package_type=${2:-container}"
}

# takes a json list of packages, and outputs newline separated url-encoded package names
packages_names() {
    jq -r '.[].name | @uri'
}

# package_versions ORG PACKAGE [PACKAGE-TYPE]
# the org and package names must be url-encoded
package_versions() {
    gh api "orgs/$1/packages/${3:-container}/$2/versions"
}

# takes a json array stream of package versions, and selects the ones last updated before
# the given unix timestamp
select_expired_versions() {
    jq 'map(select(.updated_at | fromdate | . <= $exptime))' --argjson exptime "$1"
}

# takes a json list of package versions, and filter out those with an excluded tag
exclude_tagged_versions() {
    jq 'map(select(.metadata.container.tags | any(test($exclude_tags_regex)) | not))' --arg exclude_tags_regex "$1"
}

# delete_package_version ORG PACKAGE VERSION [PACKAGE-TYPE]
delete_package_version() {
    echo "Deleting package $2 version $3"
    gh api --method DELETE "orgs/$1/packages/${4:-container}/$2/versions/$3"
}

delete_package_versions() {
    jq '.[].id' | while IFS= read -r version; do
        delete_package_version "$ORG" "$package" "$version"
    done
}

# for all packages in the organization that match the regex
packages "$ORG" | select_packages "${PACKAGE_FILTER_REGEX}" | packages_names | while IFS= read -r package; do
    echo "Processing package $package..."
    package_versions "$ORG" "$package" | \
        select_expired_versions "$retention_threshold" | \
        exclude_tagged_versions "${EXCLUDE_TAGS_REGEX}" | \
        delete_package_versions
done
