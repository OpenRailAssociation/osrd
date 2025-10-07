import dayjs from 'dayjs';
// eslint-disable-next-line import/extensions
import duration from 'dayjs/plugin/duration.js';

dayjs.extend(duration);

const SECOND_IN_MS = 1000;
const MINUTE_IN_MS = 60 * SECOND_IN_MS;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;

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

  /** Format this duration as an ISO 8601 string. */
  toISOString() {
    return dayjs.duration(this.ms).toISOString();
  }

  toJSON() {
    return this.toISOString();
  }

  add(other: Duration) {
    return new Duration({ milliseconds: this.ms + other.ms });
  }

  abs() {
    return new Duration({ milliseconds: Math.abs(this.ms) });
  }

  /**
   * Computes the number of units of time that a duration represents.
   */
  total(unit: 'second' | 'minute' | 'hour'): number {
    return this.ms / UNIT_IN_MS[unit];
  }
}

export const addDurationToDate = (date: Date, dur: Duration) => new Date(date.getTime() + dur.ms);

export const subtractDurationFromDate = (date: Date, dur: Duration) =>
  new Date(date.getTime() - dur.ms);
