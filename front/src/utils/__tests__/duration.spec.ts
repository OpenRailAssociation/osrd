import { describe, it, expect } from 'vitest';

import { Duration, msToStartTime, startTimeToDate, startTimeToMs } from 'utils/duration';

describe('startTimeToMs', () => {
  it('should return the epoch timestamp for a Date start time', () => {
    expect(startTimeToMs(new Date('2024-01-01T08:37:12.250Z'))).toEqual(1704098232250);
  });

  it('should return the offset in ms for a Duration start time', () => {
    expect(
      startTimeToMs(new Duration({ hours: 8, minutes: 37, seconds: 12, milliseconds: 250 }))
    ).toEqual(31032250);
  });
});

describe('startTimeToDate', () => {
  it('should return the same Date for a Date start time', () => {
    const startTime = new Date('2024-01-01T08:00:00Z');
    expect(startTimeToDate(startTime)).toEqual(startTime);
  });
});

describe('msToStartTime', () => {
  it('should return a Date when the reference is a Date', () => {
    expect(msToStartTime(1704098232250, new Date(0))).toEqual(new Date('2024-01-01T08:37:12.250Z'));
  });

  it('should return a Duration when the reference is a Duration', () => {
    expect(msToStartTime(31032250, Duration.zero)).toEqual(
      new Duration({ hours: 8, minutes: 37, seconds: 12, milliseconds: 250 })
    );
  });
});
