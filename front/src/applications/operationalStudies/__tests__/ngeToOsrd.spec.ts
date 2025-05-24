import { describe, it, expect } from 'vitest';

import {
  calculateStartDate,
  formatDateDifferenceFrom,
  getTimeLockDate,
} from 'applications/operationalStudies/components/MacroEditor/ngeToOsrd';
import {
  mockStartDate,
  mockStartTimeLock1,
  timeLockWithNullTime,
  mockTrainrunSections,
  sourceDeparture0min,
  sourceDeparture5min,
  sourceDeparture60min,
  startTimeLock2,
  mockArrivalTimeLock,
} from 'applications/operationalStudies/__tests__/ngeToOsrd.sampleData';

describe('calculateStartDate', () => {
  it('should return 30 minutes when 30 minutes are passed in', () => {
    const result = calculateStartDate(mockTrainrunSections, mockStartDate);
    const numberMinutes = result.getMinutes();
    expect(numberMinutes).toEqual(30);
  });

  it('should return 0 minutes when 0 minutes are passed in', () => {
    const mockTrainrunSections1 = [...mockTrainrunSections];
    mockTrainrunSections1[0].sourceDeparture = sourceDeparture0min;
    const result = calculateStartDate(mockTrainrunSections1, mockStartDate);
    const numberMinutes = result.getMinutes();
    expect(numberMinutes).toEqual(0);
  });

  it('should return 0 minutes when 60 minutes are passed in', () => {
    const mockTrainrunSections1 = [...mockTrainrunSections];
    mockTrainrunSections1[0].sourceDeparture = sourceDeparture60min;
    const result = calculateStartDate(mockTrainrunSections1, mockStartDate);
    const numberMinutes = result.getMinutes();
    expect(numberMinutes).toEqual(0);
  });

  it('should return 5 minutes when 5 minutes are passed in', () => {
    const mockTrainrunSections1 = [...mockTrainrunSections];
    mockTrainrunSections1[0].sourceDeparture = sourceDeparture5min;
    const result = calculateStartDate(mockTrainrunSections1, mockStartDate);
    const numberMinutes = result.getMinutes();
    expect(numberMinutes).toEqual(5);
  });
});

describe('formatDateDifferenceFrom', () => {
  // reference for ISO 8601 standard: https://day.js.org/docs/en/durations/as-iso-string
  it('should return +1 day in the ISO 8601 standard', () => {
    const start: Date = new Date('2025-05-24T00:00:00.000Z');
    const end: Date = new Date('2025-05-25T00:00:00.000Z');
    const DateDifference = formatDateDifferenceFrom(start, end);
    expect(DateDifference).toEqual('P1D');
  });

  it('should return 0 day in the ISO 8601 standard', () => {
    const start: Date = new Date('2025-05-24T00:00:00.000Z');
    const end: Date = new Date('2025-05-24T00:00:00.000Z');
    const DateDifference = formatDateDifferenceFrom(start, end);
    expect(DateDifference).toEqual('P0D');
  });

  it('should return +0.5 day in the ISO 8601 standard', () => {
    const start: Date = new Date('2025-05-24T00:00:00.000Z');
    const end: Date = new Date('2025-05-24T12:00:00.000Z');
    const DateDifference = formatDateDifferenceFrom(start, end);
    expect(DateDifference).toEqual('PT12H');
  });

  it('should return -2 day in the ISO 8601 standard', () => {
    const start: Date = new Date('2025-05-24T00:00:00.000Z');
    const end: Date = new Date('2025-05-22T00:00:00.000Z');
    const DateDifference = formatDateDifferenceFrom(start, end);
    expect(DateDifference).toEqual('-P2D');
  });
});

describe('getTimeLockDate', () => {
  it('should return null when time property in timeLock is null', () => {
    const result = getTimeLockDate(timeLockWithNullTime, mockStartTimeLock1, mockStartDate);
    expect(result).toEqual(null);
  });

  it('should subtract the correct number of minutes when startTimeLock has a later consecutiveTime', () => {
    const result = getTimeLockDate(mockArrivalTimeLock, startTimeLock2, mockStartDate);
    const answer: Date = new Date('2025-05-24T04:20:00.000Z');
    expect(result).toEqual(answer);
  });
});
