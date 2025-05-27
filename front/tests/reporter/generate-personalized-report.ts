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

import formatAnsiMessageToHtml from '.';
import {
  type PersonalizedTestState,
  type PersonalizedReport,
  type PersonalizedTest,
  type Attachment,
} from './type';

interface ReporterConfigOptions {
  outputFile?: string;
  outputDir?: string;
  minimal?: boolean;
  screenshot?: boolean;
  annotations?: boolean;
  testType?: string;
}

class GeneratePersonalizedReport implements Reporter {
  private readonly personalizedReport: PersonalizedReport;

  private readonly reporterConfigOptions: ReporterConfigOptions;

  private readonly reporterName = 'playwright-personalized-report';

  private readonly defaultOutputFile = 'personalized-report.json';

  private readonly defaultOutputDir = 'test-results';

  private suite: Suite | undefined;

  private startTime: number | undefined;

  constructor(config?: Partial<ReporterConfigOptions>) {
    this.reporterConfigOptions = {
      outputFile: config?.outputFile ?? this.defaultOutputFile,
      outputDir: config?.outputDir ?? this.defaultOutputDir,
      minimal: config?.minimal ?? false,
      screenshot: config?.screenshot ?? false,
      annotations: config?.annotations ?? false,
      testType: config?.testType ?? 'e2e',
    };

    this.personalizedReport = {
      results: {
        tool: {
          name: 'playwright',
        },
        summary: {
          tests: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          skipped: 0,
          other: 0,
          start: 0,
          stop: 0,
        },
        tests: [],
      },
    };
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.suite = suite;
    this.startTime = Date.now();
    this.personalizedReport.results.summary.start = this.startTime;

    const outputDir = this.reporterConfigOptions.outputDir ?? this.defaultOutputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    this.setFilename(this.reporterConfigOptions.outputFile ?? this.defaultOutputFile);
  }

  onEnd(): void {
    this.personalizedReport.results.summary.stop = Date.now();

    if (this.suite && this.suite.allTests().length > 0) {
      this.processSuite(this.suite);
      this.personalizedReport.results.summary.suites = this.countSuites(this.suite);
    }
    this.writeReportToFile(this.personalizedReport);
  }

  private processSuite(suite: Suite): void {
    suite.tests.forEach((test) => this.processTest(test));
    suite.suites.forEach((childSuite) => this.processSuite(childSuite));
  }

  private processTest(testCase: TestCase): void {
    if (testCase.results.length === 0) return;

    const latestResult = testCase.results.at(-1);
    if (latestResult) {
      this.updatePersonalizedTestResultsFromTestResult(testCase, latestResult);
      this.updateSummaryFromTestResult(latestResult);
    }
  }

  private setFilename(filename: string): void {
    this.reporterConfigOptions.outputFile = filename.endsWith('.json')
      ? filename
      : `${filename}.json`;
  }

  private updatePersonalizedTestResultsFromTestResult(
    testCase: TestCase,
    testResult: TestResult
  ): void {
    const test: PersonalizedTest = {
      name: testCase.title,
      status: GeneratePersonalizedReport.mapPlaywrightStatusToPersonalized(testResult.status),
      duration: testResult.duration,
    };

    if (!this.reporterConfigOptions.minimal) {
      this.enrichTestWithAdditionalData(test, testCase, testResult);
    }

    this.personalizedReport.results.tests.push(test);
  }

  private enrichTestWithAdditionalData(
    test: PersonalizedTest,
    testCase: TestCase,
    testResult: TestResult
  ): void {
    test.start = GeneratePersonalizedReport.updateStart(testResult.startTime);
    test.stop = GeneratePersonalizedReport.calculateStopTime(
      testResult.startTime,
      testResult.duration
    );
    test.message = GeneratePersonalizedReport.extractFailureDetails(testResult).message;
    test.trace = GeneratePersonalizedReport.extractFailureDetails(testResult).trace;
    test.rawStatus = testResult.status;
    test.tags = GeneratePersonalizedReport.extractTagsFromTitle(testCase.title);
    test.type = this.reporterConfigOptions.testType ?? 'e2e';
    test.filePath = testCase.location.file;
    test.retries = testResult.retry;
    test.flaky = testResult.status === 'passed' && testResult.retry > 0;
    test.steps = [];

    if (testResult.steps.length > 0) {
      testResult.steps.forEach((step) => {
        this.processStep(test, step);
      });
    }

    if (this.reporterConfigOptions.screenshot) {
      test.video = GeneratePersonalizedReport.extractVideoPath(testResult);
    }

    test.suite = GeneratePersonalizedReport.buildSuitePath(testCase);

    const metadata = GeneratePersonalizedReport.extractMetadata(testResult);
    if (metadata?.name || metadata?.version) {
      test.browser = `${metadata.name ?? ''} ${metadata.version ?? ''}`.trim();
    }

    test.attachments = GeneratePersonalizedReport.filterValidAttachments(testResult.attachments);
    test.stdout = testResult.stdout.map((item) =>
      Buffer.isBuffer(item) ? item.toString() : String(item)
    );
    test.stderr = testResult.stderr.map((item) =>
      Buffer.isBuffer(item) ? item.toString() : String(item)
    );

    if (this.reporterConfigOptions.annotations) {
      test.extra = { annotations: testCase.annotations };
    }
  }

  private updateSummaryFromTestResult(testResult: TestResult): void {
    this.personalizedReport.results.summary.tests += 1;

    const personalizedStatus = GeneratePersonalizedReport.mapPlaywrightStatusToPersonalized(
      testResult.status
    );
    const { summary } = this.personalizedReport.results;

    if (personalizedStatus in summary) {
      summary[personalizedStatus] += 1;
    } else {
      summary.other += 1;
    }
  }

  static mapPlaywrightStatusToPersonalized(testStatus: string): PersonalizedTestState {
    switch (testStatus) {
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

  static extractMetadata(testResult: TestResult): { name?: string; version?: string } | null {
    const metadataAttachment = testResult.attachments.find(
      (attachment) => attachment.name === 'metadata.json'
    );

    if (!metadataAttachment?.body) return null;

    try {
      const metadataRaw = metadataAttachment.body.toString('utf-8');
      return JSON.parse(metadataRaw) as { name?: string; version?: string };
    } catch (error) {
      console.error(
        'Error parsing browser metadata:',
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  static updateStart(startTime: Date): number {
    return Math.floor(new Date(startTime).getTime() / 1000);
  }

  static calculateStopTime(startTime: Date, duration: number): number {
    return Math.floor(new Date(startTime).getTime() + duration) / 1000;
  }

  static buildSuitePath(test: TestCase): string {
    const pathComponents: string[] = [];
    let currentSuite: Suite | undefined = test.parent;

    while (currentSuite) {
      if (currentSuite.title) {
        pathComponents.unshift(currentSuite.title);
      }
      currentSuite = currentSuite.parent;
    }

    return pathComponents.join(' > ');
  }

  static extractTagsFromTitle(title: string): string[] {
    const tagPattern = /@\w+/g;
    return title.match(tagPattern) ?? [];
  }

  static extractVideoPath(testResult: TestResult): string | undefined {
    const videoAttachment = testResult.attachments.find(
      (attachment) =>
        attachment.name === 'video' &&
        (attachment.contentType === 'video/webm' || attachment.contentType === 'video/mp4')
    );

    return videoAttachment?.path;
  }

  static extractFailureDetails(testResult: TestResult): Partial<PersonalizedTest> {
    if (['failed', 'timedOut', 'interrupted'].includes(testResult.status) && testResult.error) {
      return {
        message: formatAnsiMessageToHtml(testResult.error.message ?? 'No failure message'),
        trace: formatAnsiMessageToHtml(testResult.error.stack ?? 'No failure trace'),
      };
    }
    return {};
  }

  private countSuites(suite: Suite): number {
    return suite.suites.reduce(
      (count, childSuite) => count + this.countSuites(childSuite),
      suite.suites.length
    );
  }

  private writeReportToFile(data: PersonalizedReport): void {
    const filePath = path.join(
      this.reporterConfigOptions.outputDir ?? this.defaultOutputDir,
      this.reporterConfigOptions.outputFile ?? this.defaultOutputFile
    );

    try {
      fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
      console.info(
        `${this.reporterName}: successfully written Personalized json to %s/%s`,
        this.reporterConfigOptions.outputDir,
        this.reporterConfigOptions.outputFile
      );
    } catch (error) {
      console.error(`Error writing Personalized json report: ${String(error)}`);
    }
  }

  private static filterValidAttachments(attachments: TestResult['attachments']): Attachment[] {
    return attachments
      .filter((attachment) => attachment.path !== undefined)
      .map((attachment) => ({
        name: attachment.name,
        contentType: attachment.contentType,
        path: attachment.path ?? '',
      }));
  }

  private processStep(test: PersonalizedTest, step: TestStep): void {
    if (step.category === 'test.step') {
      const stepStatus = GeneratePersonalizedReport.mapPlaywrightStatusToPersonalized(
        step.error ? 'failed' : 'passed'
      );
      test.steps?.push({
        name: step.title,
        status: stepStatus,
      });
    }

    step.steps.forEach((childStep) => this.processStep(test, childStep));
  }
}

export default GeneratePersonalizedReport;
