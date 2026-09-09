import { describe, expect, test } from 'vitest';

import { Duration } from 'utils/duration';

import { createTimeLock } from '../osrdToNge';

const localDate = (hours: number, minutes: number) => new Date(2026, 0, 1, hours, minutes);

describe('createTimeLock', () => {
  test('reads the minute within the hour out of both start time kinds', () => {
    // 3 h 37 into the timetable is still minute 37 of its hour
    const offset = new Duration({ hours: 3, minutes: 37 });
    expect(createTimeLock(offset, localDate(8, 10)).time).toBe(47);
    expect(createTimeLock(offset, localDate(8, 24)).time).toBe(1);
    expect(createTimeLock(offset, Duration.zero).time).toBe(37);
    expect(createTimeLock(offset, new Duration({ hours: 1, minutes: 30 })).time).toBe(7);
  });

  test('counts consecutiveTime from the departure, without wrapping at 60 minutes', () => {
    // Departing at minute 50 and arriving 20 min later lands on minute 10 of the next hour
    const lock = createTimeLock(
      new Duration({ minutes: 20 }),
      new Duration({
        minutes: 50,
      })
    );
    expect(lock.time).toBe(10);
    expect(lock.consecutiveTime).toBe(20);
  });
});
