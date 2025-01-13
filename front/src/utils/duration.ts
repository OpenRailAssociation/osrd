/* eslint-disable import/prefer-default-export */

import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export class Duration {
  /** Number of milliseconds */
  readonly ms: number;

  constructor(ms: number) {
    this.ms = ms;
  }

  static zero = new Duration(0);

  /** Parse an ISO 8601 duration string. */
  static parse(str: string) {
    return new Duration(dayjs.duration(str).asMilliseconds());
  }

  /** Subtract two dates. */
  static subtractDate(a: Date, b: Date) {
    return new Duration(a.getTime() - b.getTime());
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
    return new Duration(this.ms + other.ms);
  }
}

export const addDurationToDate = (date: Date, dur: Duration) => new Date(date.getTime() + dur.ms);
