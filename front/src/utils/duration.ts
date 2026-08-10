import dayjs from 'dayjs';
// eslint-disable-next-line import/extensions
import duration from 'dayjs/plugin/duration.js';

dayjs.extend(duration);

const U32_MAX = 0xffff_ffff;
export const I64_MAX = 9_223_372_036_854_775_807n;

const MICROSECOND_IN_MS = 0.001;
const SECOND_IN_MS = 1000;
const MINUTE_IN_MS = 60 * SECOND_IN_MS;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;

export const MAX_DURATION_MS = Number(I64_MAX) * MICROSECOND_IN_MS; // Database will not register anything above this value

const UNIT_IN_MS = {
  second: SECOND_IN_MS,
  minute: MINUTE_IN_MS,
  hour: HOUR_IN_MS,
};

export class Duration {
  /** Number of milliseconds */
  readonly ms: number;

  constructor({ hours = 0, minutes = 0, seconds = 0, milliseconds = 0 }) {
    this.ms = hours * HOUR_IN_MS + minutes * MINUTE_IN_MS + seconds * SECOND_IN_MS + milliseconds;
  }

  static zero = new Duration({});

  /** Parse an ISO 8601 duration string. */
  static parse(str: string) {
    return new Duration({ milliseconds: dayjs.duration(str).asMilliseconds() });
  }

  /** Subtract two dates. */
  static subtractDate(a: Date, b: Date) {
    return new Duration({ milliseconds: a.getTime() - b.getTime() });
  }

  // Return the number of milliseconds, so that comparison operators work as expected.
  valueOf() {
    return this.ms;
  }

  // NOTE: As this Duration class represents a fixed-length duration (milliseconds),
  //       not calendar units, we serialize using only fixed-size units
  //       (hours, minutes and seconds) and prevent using months and years.
  //       We also consider U32_MAX as a maximum value since the backend will not
  //       be able to parse anything above this value.
  /** Format this duration as an ISO 8601 string. */
  toISOString() {
    const hours = Math.min(Math.floor(this.ms / HOUR_IN_MS), U32_MAX);
    const hoursRemain = this.ms - hours * HOUR_IN_MS;

    const minutes = Math.min(Math.floor(hoursRemain / MINUTE_IN_MS), U32_MAX);
    const minutesRemain = hoursRemain - minutes * MINUTE_IN_MS;

    const seconds = Math.floor(minutesRemain / SECOND_IN_MS);

    const h = hours ? `${hours}H` : '';
    const m = minutes ? `${minutes}M` : '';
    const s = seconds ? `${seconds}S` : '';

    if (!h && !m && !s) return 'PT0S';
    return `PT${h}${m}${s}`;
  }

  toJSON() {
    return this.toISOString();
  }

  add(other: Duration) {
    return new Duration({ milliseconds: this.ms + other.ms });
  }

  sub(other: Duration) {
    return new Duration({ milliseconds: this.ms - other.ms });
  }

  abs() {
    return new Duration({ milliseconds: Math.abs(this.ms) });
  }

  round(smallestUnit: 'second' | 'minute' | 'hour') {
    return new Duration({
      milliseconds: Math.round(this.total(smallestUnit)) * UNIT_IN_MS[smallestUnit],
    });
  }

  /**
   * Computes the number of units of time that a duration represents.
   */
  total(unit: 'second' | 'minute' | 'hour'): number {
    return this.ms / UNIT_IN_MS[unit];
  }
}

/**
 * A start time received from the backend, converted according to the timetable type:
 * a Date for calendar timetables, a Duration (offset from the timetable start) for
 * hourly timetables.
 */
export type StartTime = Date | Duration;

/**
 * Number of ms represented by a start time: elapsed ms since 1970-01-01T00:00:00Z for
 * calendar timetables (Date), elapsed ms since the timetable start for hourly
 * timetables (Duration). This is the value expected by the backend in `start_time`.
 */
export const startTimeToMs = (startTime: StartTime): number =>
  startTime instanceof Duration ? startTime.ms : startTime.getTime();

/**
 * Convert a number of ms expressed in the same hourly timetable as `reference` into a StartTime:
 * a Duration (offset from the timetable start) if the reference is a Duration (hourly timetable),
 * a Date (ms since epoch) otherwise.
 */
export const msToStartTime = (ms: number, reference: StartTime): StartTime =>
  reference instanceof Duration ? new Duration({ milliseconds: ms }) : new Date(ms);

/**
 * TODO Hourly timetables: temporary helper, remove once components handle Duration start times.
 *
 * Components are not adapted to hourly timetables yet but still expect a Date. Since no
 * Date is meaningful for an offset from the timetable start, deliberately return the
 * epoch as an obviously fictive placeholder instead of a value that could pass for a
 * real date. Each call site marks a component to migrate in a follow-up PR.
 */
export const startTimeToDate = (startTime: StartTime): Date =>
  startTime instanceof Duration ? new Date(0) : startTime;

export const addDurationToDate = (date: Date, dur: Duration) => new Date(date.getTime() + dur.ms);

/** Add a duration to a start time, keeping it a Date for calendar timetables or a Duration
 * (offset from the timetable start) for hourly timetables. */
export const addDurationToStartTime = (startTime: StartTime, dur: Duration): StartTime =>
  startTime instanceof Duration ? startTime.add(dur) : addDurationToDate(startTime, dur);

export const subtractDurationFromDate = (date: Date, dur: Duration) =>
  new Date(date.getTime() - dur.ms);

export const subtractDurationFromStartTime = (startTime: StartTime, dur: Duration) =>
  startTime instanceof Duration ? startTime.sub(dur) : subtractDurationFromDate(startTime, dur);

export const subtractStartTime = (a: StartTime, b: StartTime) => {
  if (a instanceof Date && b instanceof Date) {
    return Duration.subtractDate(a, b);
  } else if (a instanceof Duration && b instanceof Duration) {
    return a.sub(b);
  } else {
    throw new Error('Cannot subtract start times with different underlying type');
  }
};

/** Compute the difference in minutes between two dates, truncated to the minute */
export const minutesBetween = (a: Date, b: Date) =>
  new Duration({
    minutes: dayjs(a).startOf('minute').diff(dayjs(b).startOf('minute'), 'minute'),
  });
