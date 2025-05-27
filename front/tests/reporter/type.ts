export interface PersonalizedReport {
  results: Results;
}

export interface Results {
  tool: Tool;
  summary: Summary;
  tests: PersonalizedTest[];
  extra?: Record<string, unknown>;
}

export interface Summary {
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  other: number;
  suites?: number;
  start: number;
  stop: number;
  extra?: Record<string, unknown>;
}

export interface PersonalizedTest {
  name: string;
  status: PersonalizedTestState;
  duration: number;
  start?: number;
  stop?: number;
  suite?: string;
  message?: string;
  trace?: string;
  rawStatus?: string;
  tags?: string[];
  type?: string;
  filePath?: string;
  retries?: number;
  flaky?: boolean;
  attachments?: Attachment[];
  stdout?: string[];
  stderr?: string[];
  attempts?: PersonalizedTest[];
  browser?: string;
  screenshot?: string;
  video?: string;
  parameters?: Record<string, unknown>;
  steps?: Step[];
  extra?: Record<string, unknown>;
}

export interface Tool {
  name: string;
  version?: string;
  extra?: Record<string, unknown>;
}

export interface Attachment {
  name: string;
  contentType: string;
  path: string;
}

export interface Step {
  name: string;
  status: PersonalizedTestState;
}

export type PersonalizedTestState = 'passed' | 'failed' | 'skipped' | 'pending' | 'other';
