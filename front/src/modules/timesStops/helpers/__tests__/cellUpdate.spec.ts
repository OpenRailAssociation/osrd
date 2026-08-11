import { describe, it, expect } from 'vitest';

import { Duration, type StartTime, startTimeToMs } from 'utils/duration';

import { applyScheduleEdit, type ScheduleState } from '../cellUpdate';

// Fixed reference times for tests
const _10H00 = new Date('2025-01-01T10:00:00Z');
const _10H30 = new Date('2025-01-01T10:30:00Z');
const _11H00 = new Date('2025-01-01T11:00:00Z');

const _30MIN = new Duration({ minutes: 30 });
const _60MIN = new Duration({ minutes: 60 });

/** Helper to compare dates by their timestamp */
const t = (d: StartTime | null) => (d ? startTimeToMs(d) : null);
/** Helper to compare durations by their ms */
const ms = (d: Duration | null) => d?.ms ?? null;

describe('applyScheduleEdit', () => {
  describe('requestedArrival', () => {
    it('sets arrival and recomputes departure when stop exists', () => {
      const state: ScheduleState = { arrival: _10H00, stop: _30MIN };
      const result = applyScheduleEdit(state, { field: 'requestedArrival', value: _10H30 });

      expect(t(result.arrival)).toBe(t(_10H30));
      expect(ms(result.stop)).toBe(ms(_30MIN));
      // departure = 10h30 + 30min = 11h00
      expect(t(result.departure)).toBe(t(_11H00));
    });

    it('sets arrival and leaves departure null when no stop', () => {
      const state: ScheduleState = { arrival: _10H00, stop: null };
      const result = applyScheduleEdit(state, { field: 'requestedArrival', value: _10H30 });

      expect(t(result.arrival)).toBe(t(_10H30));
      expect(ms(result.stop)).toBeNull();
      expect(t(result.departure)).toBeNull();
    });

    it('clears arrival and departure, keeps stop', () => {
      const state: ScheduleState = { arrival: _10H00, stop: _30MIN };
      const result = applyScheduleEdit(state, { field: 'requestedArrival', value: null });

      expect(t(result.arrival)).toBeNull();
      expect(ms(result.stop)).toBe(ms(_30MIN));
      expect(t(result.departure)).toBeNull();
    });
  });

  describe('stopDuration', () => {
    it('sets stop and recomputes departure when arrival exists', () => {
      const state: ScheduleState = { arrival: _10H00, stop: null };
      const result = applyScheduleEdit(state, { field: 'stopDuration', value: _60MIN });

      expect(t(result.arrival)).toBe(t(_10H00));
      expect(ms(result.stop)).toBe(ms(_60MIN));
      // departure = 10h00 + 60min = 11h00
      expect(t(result.departure)).toBe(t(_11H00));
    });

    it('sets stop and leaves departure null when no arrival', () => {
      const state: ScheduleState = { arrival: null, stop: null };
      const result = applyScheduleEdit(state, { field: 'stopDuration', value: _30MIN });

      expect(t(result.arrival)).toBeNull();
      expect(ms(result.stop)).toBe(ms(_30MIN));
      expect(t(result.departure)).toBeNull();
    });

    it('clears stop and departure, keeps arrival', () => {
      const state: ScheduleState = { arrival: _10H00, stop: _30MIN };
      const result = applyScheduleEdit(state, { field: 'stopDuration', value: null });

      expect(t(result.arrival)).toBe(t(_10H00));
      expect(ms(result.stop)).toBeNull();
      expect(t(result.departure)).toBeNull();
    });
  });

  describe('stopDurationWithArrival', () => {
    it('sets both arrival and stop, computing departure from the new arrival', () => {
      const state: ScheduleState = { arrival: _10H00, stop: _30MIN };
      const result = applyScheduleEdit(state, {
        field: 'stopDurationWithArrival',
        value: { stop: _60MIN, arrival: _10H30 },
      });

      expect(t(result.arrival)).toBe(t(_10H30));
      expect(ms(result.stop)).toBe(ms(_60MIN));
      // departure = 10h30 + 60min = 11h30
      expect(t(result.departure)).toBe(new Date('2025-01-01T11:30:00Z').getTime());
    });

    it('departure stays put when arrival shifts back by the same amount stop grows', () => {
      const state: ScheduleState = { arrival: _10H00, stop: _30MIN };
      const result = applyScheduleEdit(state, {
        field: 'stopDurationWithArrival',
        value: { stop: _60MIN, arrival: new Date('2025-01-01T09:30:00Z') },
      });

      expect(t(result.departure)).toBe(t(_10H30));
    });
  });

  describe('requestedDeparture', () => {
    it('sets departure and computes stop from arrival when arrival exists', () => {
      const state: ScheduleState = { arrival: _10H00, stop: null };
      // departure = 11h00 = 10h00 + 60min
      const result = applyScheduleEdit(state, { field: 'requestedDeparture', value: _11H00 });

      expect(t(result.arrival)).toBe(t(_10H00));
      expect(ms(result.stop)).toBe(ms(_60MIN));
      expect(t(result.departure)).toBe(t(_11H00));
    });

    it('sets departure and update stop from arrival when both stop duration and arrival exists', () => {
      const state: ScheduleState = { arrival: _10H00, stop: _30MIN };
      // departure = 11h00 = 10h00 + 60min
      const result = applyScheduleEdit(state, { field: 'requestedDeparture', value: _11H00 });

      expect(t(result.arrival)).toBe(t(_10H00));
      expect(ms(result.stop)).toBe(ms(_60MIN));
      expect(t(result.departure)).toBe(t(_11H00));
    });

    it('sets departure and computes arrival from stop when no arrival', () => {
      const state: ScheduleState = { arrival: null, stop: _30MIN };
      // departure = 10h30, arrival = 10h30 - 30min = 10h00
      const result = applyScheduleEdit(state, { field: 'requestedDeparture', value: _10H30 });

      expect(t(result.arrival)).toBe(t(_10H00));
      expect(ms(result.stop)).toBe(ms(_30MIN));
      expect(t(result.departure)).toBe(t(_10H30));
    });

    it('sets departure as arrival when no arrival and no stop', () => {
      const state: ScheduleState = { arrival: null, stop: null };
      const result = applyScheduleEdit(state, { field: 'requestedDeparture', value: _10H30 });

      expect(t(result.arrival)).toBe(t(_10H30));
      expect(ms(result.stop)).toBeNull();
      expect(t(result.departure)).toBe(t(_10H30));
    });

    it('clears departure and arrival, keeps stop', () => {
      const state: ScheduleState = { arrival: _10H00, stop: _30MIN };
      const result = applyScheduleEdit(state, { field: 'requestedDeparture', value: null });

      expect(t(result.arrival)).toBeNull();
      expect(ms(result.stop)).toBe(ms(_30MIN));
      expect(t(result.departure)).toBeNull();
    });

    it('clears departure and arrival when no arrival, keeps stop', () => {
      const state: ScheduleState = { arrival: null, stop: _30MIN };
      const result = applyScheduleEdit(state, { field: 'requestedDeparture', value: null });

      expect(t(result.arrival)).toBeNull();
      expect(ms(result.stop)).toBe(ms(_30MIN));
      expect(t(result.departure)).toBeNull();
    });
  });
});
