#!/usr/bin/env bash
set -e

REPORT_FILE="$1"
OUTPUT_FILE="$2"

ICON_TESTS="📝"
ICON_SUCCESS="✅"
ICON_FAIL="❌"
ICON_SKIP="⏭️"
ICON_FLAKY="🍂"
ICON_TIME="⏱️"

TOTAL=$(jq '.results.summary.tests // 0' "$REPORT_FILE")
PASSED=$(jq '.results.summary.passed // 0' "$REPORT_FILE")
FAILED=$(jq '.results.summary.failed // 0' "$REPORT_FILE")
SKIPPED=$(jq '.results.summary.skipped // 0' "$REPORT_FILE")
START=$(jq '.results.summary.start // 0' "$REPORT_FILE")
STOP=$(jq '.results.summary.stop // 0' "$REPORT_FILE")
FLAKY_COUNT=$(jq '[.results.tests[] | select(.flaky == true)] | length' "$REPORT_FILE")

DURATION_SEC=$(( (STOP - START) / 1000 ))
DURATION=$(printf '%02d:%02d:%02d' $((DURATION_SEC/3600)) $((DURATION_SEC%3600/60)) $((DURATION_SEC%60)))

SUMMARY=$(cat <<EOF
## ${ICON_TIME} Test Summary

| Tests ${ICON_TESTS} | Passed ${ICON_SUCCESS} | Failed ${ICON_FAIL} | Skipped ${ICON_SKIP} | Flaky ${ICON_FLAKY} | Duration ${ICON_TIME}|
|-------|-----------|----------|----------|-----------|----------|
| ${TOTAL} | ${PASSED} | ${FAILED} | ${SKIPPED} | ${FLAKY_COUNT} | ${DURATION} |

EOF
)
echo "🔧 Step 0: Initialize Variables"
REPO="${GITHUB_REPOSITORY}"
RUN_ID="${GITHUB_RUN_ID}"
TOKEN="${GITHUB_TOKEN}"
echo "  - REPO=$REPO"
echo "  - RUN_ID=$RUN_ID"

echo "📦 Step 1: Fetch Artifact Metadata"
ARTIFACTS=$(curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO}/actions/runs/${RUN_ID}/artifacts")

echo "  - Retrieved artifact list:"
echo "$ARTIFACTS" | jq '.artifacts[] | {name, id}'

TRACE_ID=$(echo "$ARTIFACTS" | jq -r '.artifacts[] | select(.name == "artifact") | .id' | head -n1)

if [ -z "$TRACE_ID" ]; then
  echo "❌ ERROR: Artifact named 'artifact' not found."
  exit 1
fi
echo "  - Selected TRACE_ID: $TRACE_ID"

echo "📥 Step 2: Download artifact ZIP"
curl -sL -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -o artifact.zip \
  "https://api.github.com/repos/${REPO}/actions/artifacts/${TRACE_ID}/zip"

echo "  - artifact.zip downloaded successfully"

echo "📂 Extracting artifact.zip to extracted-artifact/"
unzip -q artifact.zip -d extracted-artifact

echo "  - Extraction complete. Contents:"
find extracted-artifact

echo "🧪 Step 3: Processing Failed Tests"

if [ "$FAILED" -gt 0 ]; then
  echo "  - FAILED count: $FAILED"

  SUMMARY+="

### ${ICON_FAIL} Failed Tests

**Total Failed Tests:** ${FAILED}

> 💡 **Inspecting Traces**
> Each failed test includes a downloadable \`trace.zip\` file.
> To view the trace, extract the archive and upload it to the [🎯 Playwright Trace Viewer](https://trace.playwright.dev/).

| Failed Test | Status | Error | Trace | Video |
|-------------|--------|-------|-------|--------|
"
  echo "  - Running jq to extract failed test info from $REPORT_FILE"
  while IFS=$'\t' read -r test_name status message; do
    trace_path="extracted-artifact/${test_name}/trace.zip"
    echo "🔎 Checking trace for test: '$test_name'"
    echo "  - Looking for file: $trace_path"

    if [ -f "$trace_path" ]; then
      trace_link="\`$trace_path\`"
      echo "  ✅ Found trace.zip for '$test_name'"
    else
      trace_link="(Not found)"
      echo "  ⚠️  trace.zip NOT found for '$test_name'"
    fi

    escaped_test_name="${test_name//|/\\|}"
    escaped_message="${message//|/\\|}"
    SUMMARY+="| $escaped_test_name | $status | $escaped_message | $trace_link | [Video](#) |\n"
  done < <(
    jq -r --arg icon_fail "$ICON_FAIL" '
      .results.tests[]
      | select(.status == "failed")
      | [.name, ($icon_fail + " failed"), (.message // "No message" | gsub("\n"; " "))]
      | @tsv
    ' "$REPORT_FILE"
  )
else
  echo "✅ No failed tests found."
fi


if [ "$FLAKY_COUNT" -gt 0 ]; then
  SUMMARY+="

### ${ICON_FLAKY} Flaky Tests

**Total Flaky Tests:** ${FLAKY_COUNT}

| Flaky Test | Status | Error |
|-------------|--------|-------|
"
  SUMMARY+=$(jq -r --arg icon_flaky "$ICON_FLAKY" '
    .results.tests[] |
    select(.flaky == true) |
    "| \(.name) | \($icon_flaky) flaky | \((.message // "No message") | gsub("\n"; " ")) |"
  ' "$REPORT_FILE")
fi

SUMMARY+="

### 🧪 Detailed Test Results

| Test Name | Status | Duration (s) | Flaky? |
|------|--------|----------------|--------|
"
SUMMARY+=$(jq -r '
  .results.tests[] |
  "| \(.name) | \(
    if .status == "passed" then "✅ passed"
    elif .status == "failed" then "❌ failed"
    elif .status == "skipped" then "⏭️ skipped"
    elif .status == "timedOut" then "⌛ timed out"
    else .status end
  ) | \((.duration // 0) / 1000) | \(
    if .flaky then "**Yes**" else "No" end
  ) |"
' "$REPORT_FILE")

echo "$SUMMARY" > "$OUTPUT_FILE"
{
  echo "summary-markdown<<EOF"
  echo "$SUMMARY"
  echo "EOF"
} >> "$GITHUB_OUTPUT"
echo "failed-count=$FAILED" >> "$GITHUB_OUTPUT"
