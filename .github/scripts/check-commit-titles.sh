#!/bin/sh

# This script reads newline separated commit titles from stdin
# output an error message when titles are deemed invalid,
# and exits accordingly

if [ -z "$NOCOLOR" ]; then
    RED=$(tput setaf 1 2>/dev/null)
    YELLOW=$(tput setaf 3 2>/dev/null)
    BLUE=$(tput setaf 4 2>/dev/null)
    RESET=$(tput sgr0 2>/dev/null)
fi


checks='check_fixup check_printable_ascii check_forbidden_chars check_structure'


check_fixup() {
    if grep -q -i '^fixup'; then
        echo 'Found a fixup commit'
    fi
}

check_printable_ascii() {
    if grep -q -P -v '^[\x20-\x7F]*$'; then
        echo 'Commit titles must be printable ascii only'
    fi
}

check_forbidden_chars() {
    if grep -q -P -v '^[^#]*$'; then
        echo 'Forbidden character found: #'
    fi
}

check_structure() {
    if grep -q -E -v '^([-_.a-z]+[,:] )*[-_.a-z]+: [a-z](:[^ ]|[^:])*$'; then
        echo 'Invalid commit title structure'
    fi
}


# read commit titles from stdin
check_failed=
while IFS= read -r commit_title; do
    # ensure failure messages are newline separated
    if [ -n "$commit_check_failed" ]; then
        printf '\n'
    fi

    # apply checks
    commit_check_failed=
    for check in $checks; do
        check_error=$(printf '%s\n' "$commit_title" | "$check")
        if [ -z "$check_error" ]; then
            continue
        fi

        # if it's the first error for this commit, print the error header
        if [ -z "$commit_check_failed" ]; then
            printf '%sinvalid commit title:%s ' "$RED" "$RESET"
            printf '%s"%s"%s\n' "$BLUE" "$commit_title" "$RESET"
        fi

        printf '   %s- %s%s\n' "$RED" "$check_error" "$RESET"
        commit_check_failed=y
        check_failed=y
    done
done

if [ -z "$check_failed" ]; then
    exit 0
fi

cat<<EOF

All commit messages must use the following format:
  ${BLUE}core: add fancy margin support${RESET}

When a commit changes multiple modules, separate module names with ", ":
  ${BLUE}core, editoast: fix curve simplification${RESET}

If the involved module are bound by a hierarchical relationship, use ": " instead:
  ${BLUE}core: signaling: support distant signals${RESET}

The following characters are forbidden:
  - anything outside of the ascii range
  - non-printable ascii (which includes tabs)
  - #

Commit title structure has to be as follows:
  - one or more module names ([-_.a-z]+), separated by comma or colon, terminated by ": "
  - the actual title, starting with a lowercase letter and not containing ": "
EOF
exit 1
