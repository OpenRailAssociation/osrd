#!/bin/sh

set -e

if [ $# -lt 1 ]
then
    (
        echo "usage: $0 TIMETABLE.JSON"
        echo
        echo "Shifts a calendar timetable to 01/01/1970"
        echo "Writes the output to stdout"
    ) >&2
    exit 1
fi

command -v jq >/dev/null 2>/dev/null || (
    echo "command not found: jq"
    exit 1
) >&2

timetable=$1

min_start_time_ms=$(jq <"$timetable" '[ .train_schedules.[].start_time ] | min')
min_start_time_s=${min_start_time_ms%???}
min_start_date=$(date +%s --date="$(date +%Y-%m-%d --date="@$min_start_time_s")")

jq <"$timetable" ".train_schedules.[].start_time -= ${min_start_date}000"
