import { describe, it, expect } from 'vitest';

import {
  generateCodeNumber,
  getStopDurationTime,
  getStopDurationAtPosition,
} from 'applications/stdcm/utils/formatSimulationReportSheet';
import { Duration } from 'utils/duration';

describe('generateCodeNumber', () => {
  it('should return a formatted string', () => {
    const codeNumber = generateCodeNumber();
    expect(codeNumber).toMatch(/^\d{2}\d{2}-\d{3}-\d{3}$/);
  });
});

describe('getStopDurationTime', () => {
  it('should return correct time format', () => {
    expect(getStopDurationTime(new Duration({ seconds: 120 }))).toBe('2 min');
  });
});

describe('getStopDurationBetweenTwoPositions', () => {
  it('should return stop duration correctly', () => {
    const trainPositions = [1, 2, 2, 3];
    const trainTimes = [10000, 120000, 180000];
    expect(getStopDurationAtPosition(2, trainPositions, trainTimes)).toEqual(
      new Duration({ milliseconds: 60000 })
    );
    expect(getStopDurationAtPosition(1, trainPositions, trainTimes)).toBeNull();
  });
});
