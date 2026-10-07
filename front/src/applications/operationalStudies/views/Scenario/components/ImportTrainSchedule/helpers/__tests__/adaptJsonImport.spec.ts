import dayjs from 'dayjs';
import { describe, it, expect } from 'vitest';

import type {
  TimetableJsonPayload,
  TrainScheduleFromJson,
} from 'applications/operationalStudies/types';
import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { DEFAULT_HOURLY_TIMETABLE_DURATION } from 'modules/trainSchedule/helpers/hourlyTimetable';
import { Duration } from 'utils/duration';

import {
  adaptCalendarExceptionToHourly,
  adaptPayloadForTargetTimetable,
  getPayloadTimetableType,
} from '../adaptJsonImport';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

// Built in local time so that the tests do not depend on the timezone
const DAY = '2026-01-15';
const localTime = (time: string) => dayjs(`${DAY}T${time}`).valueOf();
const localMidnight = localTime('00:00:00');

const baseTrain: TrainScheduleFromJson = {
  train_name: 'test',
  rolling_stock_name: 'test',
  constraint_distribution: 'STANDARD',
  start_time: 0,
  path: [],
};

const existingTrain: TrainScheduleResponse = {
  train_name: 'existing',
  rolling_stock_name: 'test',
  constraint_distribution: 'STANDARD',
  path: [],
  id: 0,
  train_schedule_set_id: 0,
  start_time: localTime('08:00:00'),
};

const buildPayload = (
  trains: TrainScheduleFromJson[],
  timetableType?: TimetableJsonPayload['timetable_type']
): TimetableJsonPayload => ({
  ...(timetableType && { timetable_type: timetableType }),
  train_schedules: trains,
});

describe('getPayloadTimetableType', () => {
  it('should return the payload timetable type', () => {
    expect(getPayloadTimetableType(buildPayload([], 'HOURLY'))).toBe('HOURLY');
  });

  it('should consider payloads without timetable type as calendar ones', () => {
    expect(getPayloadTimetableType(buildPayload([]))).toBe('CALENDAR');
  });
});

describe('adaptCalendarExceptionToHourly', () => {
  const interval = new Duration({ minutes: 30 });
  const timeWindow = new Duration({ hours: 2 });

  it('should shift the occurrence index by the number of removed occurrences', () => {
    // 10:30 is 21 intervals of 30 min after midnight, and there are 4 occurrences in 2h
    const timeOfDayMs = 10 * HOUR_MS + 30 * MINUTE_MS;
    expect(
      adaptCalendarExceptionToHourly(
        { key: 'a', occurrence_index: 1 },
        {
          timeOfDayMs,
          interval,
          timeWindow,
        }
      ).occurrence_index
    ).toBe((1 + 21) % 4);
  });

  it('should keep exceptions without occurrence index', () => {
    const exception = { key: 'a' };
    expect(
      adaptCalendarExceptionToHourly(exception, { timeOfDayMs: HOUR_MS, interval, timeWindow })
    ).toEqual(exception);
  });

  it('should bring the start time back to the time of day modulo the time window', () => {
    expect(
      adaptCalendarExceptionToHourly(
        { key: 'a', start_time: { value: localTime('11:15:00') } },
        { timeOfDayMs: 0, interval, timeWindow }
      ).start_time
    ).toEqual({ value: HOUR_MS + 15 * MINUTE_MS });
  });
});

describe('adaptPayloadForTargetTimetable', () => {
  describe('CALENDAR → HOURLY', () => {
    it('should convert unique trains to paced trains spanning the hourly timetable duration', () => {
      const payload = buildPayload([{ ...baseTrain, start_time: localTime('10:30:00') }]);

      const result = adaptPayloadForTargetTimetable(payload, 'HOURLY', []);

      expect(result.timetable_type).toBe('HOURLY');
      expect(result.train_schedules[0]).toEqual({
        ...baseTrain,
        // 10:30 % 2h
        start_time: 30 * MINUTE_MS,
        paced: {
          interval: DEFAULT_HOURLY_TIMETABLE_DURATION.toISOString(),
          time_window: DEFAULT_HOURLY_TIMETABLE_DURATION.toISOString(),
          exceptions: [],
        },
      });
    });

    it('should accept ISO string start times', () => {
      const payload = buildPayload([
        { ...baseTrain, start_time: new Date(localTime('10:30:00')).toISOString() },
      ]);

      const result = adaptPayloadForTargetTimetable(payload, 'HOURLY', []);

      expect(result.train_schedules[0].start_time).toBe(30 * MINUTE_MS);
    });

    it('should bring paced trains start time under their interval and adapt their exceptions', () => {
      const payload = buildPayload([
        {
          ...baseTrain,
          start_time: localTime('10:40:00'),
          paced: {
            interval: 'PT30M',
            time_window: 'PT2H',
            exceptions: [
              { key: 'a', occurrence_index: 1 },
              { key: 'b', start_time: { value: localTime('11:15:00') } },
            ],
          },
        },
      ]);

      const result = adaptPayloadForTargetTimetable(payload, 'HOURLY', []);

      expect(result.train_schedules[0]).toEqual({
        ...baseTrain,
        start_time: 10 * MINUTE_MS,
        paced: {
          interval: 'PT30M',
          time_window: 'PT2H',
          exceptions: [
            { key: 'a', occurrence_index: (1 + 21) % 4 },
            { key: 'b', start_time: { value: HOUR_MS + 15 * MINUTE_MS } },
          ],
        },
      });
    });
  });

  describe('HOURLY → CALENDAR', () => {
    const payload = buildPayload(
      [
        {
          ...baseTrain,
          start_time: 10 * MINUTE_MS,
          paced: {
            interval: 'PT30M',
            time_window: 'PT2H',
            exceptions: [{ key: 'a', start_time: { value: HOUR_MS } }],
          },
        },
        { ...baseTrain, start_time: 20 * MINUTE_MS },
      ],
      'HOURLY'
    );

    it('should anchor start times to the day of the earliest existing train', () => {
      const result = adaptPayloadForTargetTimetable(payload, 'CALENDAR', [
        { ...existingTrain, id: 1, start_time: localTime('12:00:00') },
        existingTrain,
      ]);

      expect(result.timetable_type).toBe('CALENDAR');
      expect(result.train_schedules).toEqual([
        {
          ...baseTrain,
          start_time: localMidnight + 10 * MINUTE_MS,
          paced: {
            interval: 'PT30M',
            time_window: 'PT2H',
            exceptions: [{ key: 'a', start_time: { value: localMidnight + HOUR_MS } }],
          },
        },
        { ...baseTrain, start_time: localMidnight + 20 * MINUTE_MS, paced: undefined },
      ]);
    });

    it('should anchor start times to today when there is no existing train', () => {
      const result = adaptPayloadForTargetTimetable(payload, 'CALENDAR', []);

      expect(result.train_schedules[1].start_time).toBe(
        dayjs().startOf('day').valueOf() + 20 * MINUTE_MS
      );
    });
  });
});
