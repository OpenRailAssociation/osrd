import fs from 'fs';

import { formatDuration } from '.';
import type { Artifact, GithubSummaryReport, ArtifactResponse } from './playwright-report-types';

const reportPath = process.argv[2];
const outputPath = process.argv[3];

const REPO = process.env.GITHUB_REPOSITORY!;
const RUN_ID = process.env.GITHUB_RUN_ID!;
const TOKEN = process.env.GITHUB_TOKEN!;

async function fetchArtifacts(
  repo: string,
  runId: string,
  token: string
): Promise<ArtifactResponse> {
  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    throw new Error(`Invalid repository format: ${repo}`);
  }

  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repoName);
  const encodedRunId = encodeURIComponent(runId);

  const url = `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/actions/runs/${encodedRunId}/artifacts`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'node.js',
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }

  try {
    return (await response.json()) as ArtifactResponse;
  } catch {
    throw new Error('Failed to parse artifact response');
  }
}

function getArtifactIdByName(artifacts: Artifact[], name: string): string | null {
  const match = artifacts.find((artifact) => artifact.name === name);
  return match ? match.id.toString() : null;
}

function formatStatus(status: string): string {
  switch (status) {
    case 'passed':
      return '✅ passed';
    case 'failed':
      return '❌ failed';
    case 'skipped':
      return '⏭️ skipped';
    case 'timedOut':
      return '⏱️ timed out';
    default:
      return status;
  }
}
await (async () => {
  const report: GithubSummaryReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

  const { summary, tests } = report.results;
  const allBrowsers = [...new Set(tests.map((t) => t.browser?.toLowerCase() || 'unknown'))];
  const useBrowserColumn = allBrowsers.length > 1;

  const flakyTests = tests.filter((t) => t.flaky);
  const failedTests = tests.filter((t) => t.status === 'failed');

  const duration = formatDuration(summary.start, summary.stop);

  const { artifacts } = await fetchArtifacts(REPO, RUN_ID, TOKEN);

  const traceId = getArtifactIdByName(artifacts, 'playwright-traces');
  const mediaId = getArtifactIdByName(artifacts, 'playwright-media');

  const traceUrl = traceId
    ? `https://github.com/${REPO}/actions/runs/${RUN_ID}/artifacts/${traceId}`
    : 'Trace artifact not found';

  const mediaUrl = mediaId
    ? `https://github.com/${REPO}/actions/runs/${RUN_ID}/artifacts/${mediaId}`
    : 'Video and screenshot artifact not found';

  let summaryMd = `
## 📊 Test Summary

| Tests 📝 | Passed ✅ | Failed ❌ | Skipped ⏭️ | Flaky 🍂 | Duration ⏱️ |
|----------------------|-------------------------|-----------------------|------------------------|----------------------|------------------------|
| ${summary.tests} | ${summary.passed} | ${summary.failed} | ${summary.skipped} | ${flakyTests.length} | ${duration} |
`;

  if (failedTests.length > 0) {
    summaryMd += `

### ❌ Failed Tests

**Total Failed Tests:** ${failedTests.length}

💡 **Inspecting Traces**

> Each failed test includes a downloadable \`trace.zip\` file.
> To view the trace, extract the archive and upload it to the 🎯 [Playwright Trace Viewer](https://trace.playwright.dev/)
- 📦 [Download Traces](${traceUrl})
- 🎥 [Download Videos and screenshots](${mediaUrl})

| Failed Test | Status | Error |
|-------------|--------|-------|
${failedTests
  .map((t) => `| ${t.name} | ❌ failed | ${(t.message ?? 'No message').replace(/\n/g, ' ')} |`)
  .join('\n')}
`;
  }

  if (flakyTests.length > 0) {
    summaryMd += `

### 🍂 Flaky Tests

**Total Flaky Tests:** ${flakyTests.length}

| Flaky Test | Status | Error |
|------------|--------|-------|
${flakyTests
  .map((t) => `| ${t.name} | 🍂 flaky | ${(t.message ?? 'No message').replace(/\n/g, ' ')} |`)
  .join('\n')}
`;
  }

  summaryMd += `

### 🧪 Detailed Test Results

${!useBrowserColumn ? `💡 Tests were executed using: \`${allBrowsers[0]}\`\n\n` : ''}

| Test Name | Status | Duration (s) | Flaky?${useBrowserColumn ? ' | Browser & Version' : ''} |
|-----------|--------|--------------|--------${useBrowserColumn ? '|---------' : ''}|
${tests
  .map((t) => {
    const row = [
      t.name,
      formatStatus(t.status),
      (t.duration ?? 0) / 1000,
      t.flaky ? '**Yes**' : 'No',
    ];

    if (useBrowserColumn) {
      const browserDisplay =
        t.browser?.toLowerCase().includes('chromium') ||
        t.browser?.toLowerCase().includes('firefox')
          ? t.browser
          : 'None';
      row.push(browserDisplay);
    }

    return `| ${row.join(' | ')} |`;
  })
  .join('\n')}
`;

  fs.writeFileSync(outputPath, summaryMd);
})();
