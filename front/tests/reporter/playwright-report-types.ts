// Playwright personalized JSON report types

/**
 * Options for configuring the custom Playwright reporter.
 */
export type ReporterOptions = {
  outputFile?: string;
  outputDir?: string;
  minimal?: boolean;
  annotations?: boolean;
  testType?: string;
};

/**
 * The top-level structure of the personalized test report.
 */
export type PersonalizedReport = {
  results: PersonalizedResults;
};

/**
 * Contains metadata and list of test cases in the report.
 */
export type PersonalizedResults = {
  toolName: string;
  summary: PersonalizedSummary;
  tests: PersonalizedTest[];
  extra?: Record<string, unknown>;
};

/**
 * Aggregated test statistics.
 */
export type PersonalizedSummary = {
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  other: number;
  suites?: number;
  start: number; // Unix timestamp in milliseconds
  stop: number; // Unix timestamp in milliseconds
  extra?: Record<string, unknown>;
};

/**
 * Detailed information about a single test case.
 */
export type PersonalizedTest = {
  name: string;
  status: PersonalizedTestState;
  duration: number;
  start?: number;
  stop?: number;
  suite?: string;
  message?: string;
  trace?: string;
  rawStatus?: string;
  filePath?: string;
  retries?: number;
  flaky?: boolean;
  stdout?: string[];
  stderr?: string[];
  browser?: string;
  steps?: Step[];
};

/**
 * Represents a step inside a test, with its execution status.
 */
export type Step = {
  name: string;
  status: PersonalizedTestState;
};

/**
 * Valid states for a test or step.
 */
export type PersonalizedTestState = 'passed' | 'failed' | 'skipped' | 'pending' | 'other';

/**
 * Optional test attachment (e.g. screenshot, trace).
 */
export type Attachment = {
  name: string;
  contentType: string;
  path: string;
};

// GitHub summary report types

/**
 * A simplified test case used for the GitHub summary report.
 */
export type GithubTestSummary = {
  name: string;
  status: string;
  message?: string;
  duration?: number;
  flaky?: boolean;
  browser?: string;
};

/**
 * Aggregated GitHub summary stats.
 */
export type ReportSummary = {
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  other: number;
  start: number;
  stop: number;
};

/**
 * The GitHub-compatible summary report structure.
 */
export type GithubSummaryReport = {
  results: {
    summary: ReportSummary;
    tests: GithubTestSummary[];
  };
};

/**
 * Represents a single uploaded GitHub artifact.
 */
export type Artifact = {
  id: number;
  name: string;
};

/**
 * Response from GitHub Actions when fetching uploaded artifacts.
 */
export type ArtifactResponse = {
  artifacts: Artifact[]; // List of uploaded artifacts in the GitHub run
};
