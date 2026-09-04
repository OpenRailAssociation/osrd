import type { TimetableJsonPayload, TrainScheduleFromJson } from 'applications/operationalStudies/types';
import type { TimetableType, TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

const TWO_HOURS_MS = new Duration({ hours: 2 }).ms;

/** Compute the current hourly timetable duration (LCM of paced trains' time_windows, 2h default). */
function getHourlyTimetableDurationMs(existingTrains: TrainScheduleResponse[]): number {
  const durations = existingTrains
    .filter((t) => t.paced)
    .map((t) => Duration.parse(t.paced!.time_window).ms);
  if (durations.length === 0) return TWO_HOURS_MS;
  return durations.reduce((a, b) => lcm(a, b));
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

/** Adapt a calendar-typed payload for import into an hourly timetable. */
function calendarToHourly(
  trains: TrainScheduleFromJson[],
  existingHourlyTrains: TrainScheduleResponse[]
): TrainScheduleFromJson[] {
  const hourlyDurationMs = getHourlyTimetableDurationMs(existingHourlyTrains);

  return trains.map((train) => {
    const startTimeMs =
      typeof train.start_time === 'string' ? new Date(train.start_time).getTime() : train.start_time;

    if (train.paced) {
      const missionDurationMs = Duration.parse(train.paced.time_window).ms;
      const newOffset = startTimeMs % missionDurationMs;

      const adaptedExceptions = train.paced.exceptions.map((exc) =>
        exc.start_time ? { ...exc, start_time: { value: exc.start_time.value % missionDurationMs } } : exc
      );

      return {
        ...train,
        start_time: newOffset,
        paced: { ...train.paced, exceptions: adaptedExceptions },
      };
    }

    // unique train → convert to paced
    const durationIso = new Duration({ milliseconds: hourlyDurationMs }).toISOString();
    return {
      ...train,
      start_time: startTimeMs % hourlyDurationMs,
      paced: {
        time_window: durationIso,
        interval: durationIso,
        exceptions: [],
      },
    };
  });
}

/** Adapt an hourly-typed payload for import into a calendar timetable. */
function hourlyToCalendar(
  trains: TrainScheduleFromJson[],
  existingCalendarTrains: TrainScheduleResponse[]
): TrainScheduleFromJson[] {
  const referenceMs = (() => {
    if (existingCalendarTrains.length === 0) {
      // today at 00:00:00 UTC
      const now = new Date();
      return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    }
    return Math.min(...existingCalendarTrains.map((t) => t.start_time));
  })();

  return trains.map((train) => {
    const importedOffsetMs =
      typeof train.start_time === 'string' ? new Date(train.start_time).getTime() : train.start_time;

    if (train.paced) {
      const missionDurationMs = Duration.parse(train.paced.time_window).ms;
      const newStartTime =
        referenceMs - (referenceMs % missionDurationMs) + importedOffsetMs;

      return { ...train, start_time: newStartTime };
    }

    // unique train from hourly: treat offset as-is relative to reference
    return { ...train, start_time: referenceMs + importedOffsetMs };
  });
}

/**
 * Adapt an imported JSON payload to the target timetable type.
 * - Same type → no-op
 * - CALENDAR → HOURLY: adapt start_times and convert unique trains to paced
 * - HOURLY → CALENDAR: anchor offsets to the first existing calendar train (or today midnight)
 */
export function adaptPayloadForTargetTimetable(
  payload: TimetableJsonPayload,
  targetType: TimetableType,
  existingTrains: TrainScheduleResponse[]
): TimetableJsonPayload {
  const sourceType = payload.timetable_type;

  if (!sourceType || sourceType === targetType) return payload;

  const adaptedTrains =
    sourceType === 'CALENDAR' && targetType === 'HOURLY'
      ? calendarToHourly(payload.train_schedules, existingTrains)
      : hourlyToCalendar(payload.train_schedules, existingTrains);

  return { ...payload, train_schedules: adaptedTrains };
}
