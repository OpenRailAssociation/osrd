import dayjs from 'dayjs';

import type {
  TimetableJsonPayload,
  TrainScheduleFromJson,
} from 'applications/operationalStudies/types';
import type {
  PacedTrainException,
  TimetableType,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import { computeHourlyTimetableDuration } from 'modules/trainSchedule/helpers/hourlyTimetable';
import { getOccurrencesNb } from 'modules/trainSchedule/helpers/pacedTrain';
import { Duration } from 'utils/duration';

const startTimeToMs = (startTime: TrainScheduleFromJson['start_time']): number =>
  typeof startTime === 'string' ? new Date(startTime).getTime() : startTime;

/** Number of ms elapsed since the local midnight of an epoch timestamp */
const msSinceLocalMidnight = (epochMs: number): number =>
  epochMs - dayjs(epochMs).startOf('day').valueOf();

const mapExceptionStartTime = (
  exception: PacedTrainException,
  mapStartTime: (ms: number) => number
): PacedTrainException =>
  exception.start_time
    ? { ...exception, start_time: { value: mapStartTime(exception.start_time.value) } }
    : exception;

/**
 * Adapt a calendar-typed payload for import into an hourly timetable.
 *
 * - Paced trains keep their duration. Their start time becomes the local time of day modulo the
 *   interval (the database requires `start_time < interval` in hourly timetables), and the
 *   occurrence indexes of the exceptions are shifted accordingly so that they still target the
 *   same occurrences. Exception start times become the local time of day modulo the duration.
 * - Unique trains become paced trains whose duration and interval are equal to the hourly
 *   timetable duration, starting at their local time of day modulo this duration.
 */
function calendarToHourly(
  trains: TrainScheduleFromJson[],
  existingTrains: TrainScheduleResponse[]
): TrainScheduleFromJson[] {
  const hourlyTimetableDuration = computeHourlyTimetableDuration(existingTrains);

  return trains.map((train) => {
    const timeOfDayMs = msSinceLocalMidnight(startTimeToMs(train.start_time));

    if (!train.paced) {
      return {
        ...train,
        start_time: timeOfDayMs % hourlyTimetableDuration.ms,
        paced: {
          interval: hourlyTimetableDuration.toISOString(),
          time_window: hourlyTimetableDuration.toISOString(),
          exceptions: [],
        },
      };
    }

    const interval = Duration.parse(train.paced.interval);
    const timeWindow = Duration.parse(train.paced.time_window);
    const occurrencesCount = getOccurrencesNb({ interval, timeWindow });
    const shiftedOccurrencesCount = Math.floor(timeOfDayMs / interval.ms);

    return {
      ...train,
      start_time: timeOfDayMs % interval.ms,
      paced: {
        ...train.paced,
        exceptions: train.paced.exceptions.map((exception) => {
          const shiftedException =
            exception.occurrence_index !== undefined
              ? {
                  ...exception,
                  occurrence_index:
                    (exception.occurrence_index + shiftedOccurrencesCount) % occurrencesCount,
                }
              : exception;
          return mapExceptionStartTime(
            shiftedException,
            (ms) => msSinceLocalMidnight(ms) % timeWindow.ms
          );
        }),
      },
    };
  });
}

/**
 * Return the local midnight of the day of the earliest train, or of today if there is no train.
 */
const computeCalendarReferenceDate = (existingTrains: TrainScheduleResponse[]): Date => {
  if (existingTrains.length === 0) return dayjs().startOf('day').toDate();
  const earliestStartTime = Math.min(...existingTrains.map(({ start_time }) => start_time));
  return dayjs(earliestStartTime).startOf('day').toDate();
};

/**
 * Adapt an hourly-typed payload for import into a calendar timetable, by adding the reference
 * date (midnight of the day of the first existing train, or of today) to the start times of the
 * trains and of their exceptions.
 */
function hourlyToCalendar(
  trains: TrainScheduleFromJson[],
  existingTrains: TrainScheduleResponse[]
): TrainScheduleFromJson[] {
  const referenceMs = computeCalendarReferenceDate(existingTrains).getTime();
  const toCalendarStartTime = (ms: number) => referenceMs + ms;

  return trains.map((train) => ({
    ...train,
    start_time: toCalendarStartTime(startTimeToMs(train.start_time)),
    paced: train.paced && {
      ...train.paced,
      exceptions: train.paced.exceptions.map((exception) =>
        mapExceptionStartTime(exception, toCalendarStartTime)
      ),
    },
  }));
}

/**
 * Adapt an imported JSON payload to the target timetable type.
 * - Same type → no-op
 * - CALENDAR → HOURLY: adapt start times and convert unique trains to paced
 * - HOURLY → CALENDAR: anchor offsets to the day of the first existing train (or today)
 *
 * Payloads without timetable type (older exports, NGE, XML…) are considered as calendar ones.
 */
export function adaptPayloadForTargetTimetable(
  payload: TimetableJsonPayload,
  targetType: TimetableType,
  existingTrains: TrainScheduleResponse[]
): TimetableJsonPayload {
  const sourceType = payload.timetable_type ?? 'CALENDAR';

  if (sourceType === targetType) return payload;

  const adaptedTrains =
    targetType === 'HOURLY'
      ? calendarToHourly(payload.train_schedules, existingTrains)
      : hourlyToCalendar(payload.train_schedules, existingTrains);

  return { ...payload, timetable_type: targetType, train_schedules: adaptedTrains };
}
