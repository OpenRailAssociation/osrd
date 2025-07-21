import fs from 'fs';
import path from 'path';

import {
  type Suite,
  type Reporter,
  type TestCase,
  type TestResult,
  type FullConfig,
  type TestStep,
} from '@playwright/test/reporter';

import { formatAnsiMessageToHtml } from '.';
import type {
  PersonalizedReport,
  PersonalizedTest,
  PersonalizedTestState,
  ReporterOptions,
} from './playwright-report-types';
import { logger } from '../logging-fixture';

// This class generates a personalized JSON report from Playwright test execution.
class GenerateReport implements Reporter {
  private readonly personalizedReport: PersonalizedReport;

  private readonly reporterConfigOptions: ReporterOptions;

  private readonly reporterName = 'playwright-personalized-report';

  private readonly defaultOutputFile = 'personalized-report.json';

  private readonly defaultOutputDir = 'test-results';

  private suite?: Suite;

  private startTime?: number;

  /**
   * Initialize the reporter with optional configuration.
   * Set default values for output file, output directory, and reporting flags.
   */
  constructor(config?: Partial<ReporterOptions>) {
    this.reporterConfigOptions = {
      outputFile: this.defaultOutputFile,
      outputDir: this.defaultOutputDir,
      minimal: config?.minimal ?? false,
      testType: config?.testType ?? 'e2e',
    };

    // Initialize the base structure of the report with empty summary and test list
    this.personalizedReport = {
      results: {
        toolName: 'playwright',
        summary: {
          tests: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          pending: 0,
          other: 0,
          start: 0,
          stop: 0,
        },
        tests: [],
      },
    };
  }

  /**
   * Called when the test run begins.
   * Prepare directory and set report filename.
   */
  onBegin(_config: FullConfig, suite: Suite) {
    this.suite = suite;
    this.startTime = Date.now();
    this.personalizedReport.results.summary.start = this.startTime;

    const outputDir = this.reporterConfigOptions.outputDir!;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Called at the end of the test run.
   * Process all test results and write final report to disk.
   */
  onEnd() {
    this.personalizedReport.results.summary.stop = Date.now();

    if (this.suite && this.suite.allTests().length > 0) {
      this.processSuite(this.suite);
      this.personalizedReport.results.summary.suites = this.countSuites(this.suite);
    }

    this.writeReportToFile(this.personalizedReport);
  }

  /** Process test cases in the suite and nested child suites.
   * Note: This value is not used yet, but will support future visualizations.
   */
  private processSuite(suite: Suite) {
    suite.tests.forEach((test) => this.processTest(test));
    suite.suites.forEach((child) => this.processSuite(child));
  }

  // Process a single test case by extracting its latest result.
  private processTest(testCase: TestCase) {
    const latestResult = testCase.results.at(-1);
    if (!latestResult) return;

    this.addTestResult(testCase, latestResult);
    this.updateSummary(latestResult);
  }

  // Add a test case result to the report, with optional enrichment.
  private addTestResult(testCase: TestCase, result: TestResult) {
    const test: PersonalizedTest = {
      name: testCase.title,
      status: GenerateReport.mapStatus(result.status),
      duration: result.duration,
    };

    if (!this.reporterConfigOptions.minimal) {
      this.enrichTestData(test, testCase, result);
    }

    this.personalizedReport.results.tests.push(test);
  }

  // Add detailed metadata to the test result: timestamps, logs, retries, suite path, etc.
  private enrichTestData(test: PersonalizedTest, testCase: TestCase, result: TestResult) {
    test.start = GenerateReport.addDurationToDateAndConvertToUnix(result.startTime);
    test.stop = GenerateReport.addDurationToDateAndConvertToUnix(result.startTime, result.duration);
    test.rawStatus = result.status;
    test.filePath = testCase.location.file;
    test.retries = result.retry;
    test.flaky = result.status === 'passed' && result.retry > 0;
    test.steps = [];

    const failure = GenerateReport.extractFailureDetails(result);
    test.message = failure.message;
    test.trace = failure.trace;

    result.steps.forEach((step) => this.processStep(test, step));

    test.suite = GenerateReport.buildSuitePath(testCase);

    const metadata = GenerateReport.extractBrowserMetadata(result);
    if (metadata?.name || metadata?.version) {
      test.browser = `${metadata.name ?? ''} ${metadata.version ?? ''}`.trim();
    }

    test.stdout = result.stdout.map((item) => item.toString());

    test.stderr = result.stderr.map((item) => item.toString());
  }

  // Update the overall test summary counts (passed, failed, etc.)
  private updateSummary(result: TestResult) {
    const { summary } = this.personalizedReport.results;
    summary.tests += 1;

    const status = GenerateReport.mapStatus(result.status);
    if (status in summary) {
      summary[status] += 1;
    } else {
      summary.other += 1;
    }
  }

  // Write the final report JSON to the configured output file.
  private writeReportToFile(report: PersonalizedReport) {
    const outputDir = this.reporterConfigOptions.outputDir!;
    const outputFile = this.reporterConfigOptions.outputFile!;
    const filePath = path.join(outputDir, outputFile);

    try {
      fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`);
    } catch (err) {
      logger.error(`${this.reporterName}: error writing report —`, String(err));
    }
  }

  /**
   * Count all nested test suites.
   * Note: This value is not used yet, but will support future visualizations.
   */
  private countSuites(suite: Suite): number {
    return suite.suites.reduce((count, s) => count + this.countSuites(s), suite.suites.length);
  }

  // Process a test step and add them to the report
  private processStep(test: PersonalizedTest, step: TestStep) {
    if (step.category === 'test.step') {
      const status = GenerateReport.mapStatus(step.error ? 'failed' : 'passed');
      test.steps!.push({ name: step.title, status });
    }

    step.steps.forEach((subStep) => this.processStep(test, subStep));
  }

  // Map Playwright's internal status to a simplified status model.
  private static mapStatus(status: string): PersonalizedTestState {
    switch (status) {
      case 'passed':
        return 'passed';
      case 'failed':
      case 'timedOut':
      case 'interrupted':
        return 'failed';
      case 'skipped':
        return 'skipped';
      case 'pending':
        return 'pending';
      default:
        return 'other';
    }
  }

  private static addDurationToDateAndConvertToUnix(start: Date, duration = 0): number {
    return Math.floor(new Date(start).getTime() + duration) / 1000;
  }

  /** Build a readable suite path (e.g. "Root > Feature > Scenario").
   * Note: This value is not used yet, but will support future visualizations.
   */
  private static buildSuitePath(test: TestCase): string {
    const segments: string[] = [];
    let suite: Suite | undefined = test.parent;

    while (suite) {
      if (suite.title) segments.unshift(suite.title);
      suite = suite.parent;
    }

    return segments.join(' > ');
  }

  private static extractFailureDetails(result: TestResult): Partial<PersonalizedTest> {
    if (['failed', 'timedOut', 'interrupted'].includes(result.status) && result.error) {
      return {
        message: formatAnsiMessageToHtml(result.error.message ?? 'No failure message'),
        trace: formatAnsiMessageToHtml(result.error.stack ?? 'No failure trace'),
      };
    }
    return {};
  }

  private static extractBrowserMetadata(
    result: TestResult
  ): { name?: string; version?: string } | null {
    const meta = result.attachments.find((a) => a.name === 'metadata.json');
    if (!meta?.body) return null;

    try {
      return JSON.parse(meta.body.toString('utf-8')) as { name?: string; version?: string };
    } catch (err) {
      logger.error('Error parsing metadata.json:', err instanceof Error ? err.message : err);
      return null;
    }
  }
}

export default GenerateReport;
