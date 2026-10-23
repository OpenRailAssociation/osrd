import { describe, it, expect } from 'vitest';

import type { PathItem, ScheduleItem } from 'common/api/osrdEditoastApi';
import { Duration, type StartTime, startTimeToMs } from 'utils/duration';

import { applyScheduleEdit, upsertScheduleItem, type ScheduleState } from '../cellUpdate';

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

describe('upsertScheduleItem', () => {
  const makePath = () =>
    [
      { key: 'a', location: {} },
      { key: 'b', location: {} },
      { key: 'c', location: {} },
    ] as unknown as PathItem[];

  it('clearing requested arrival preserves requested base arrival', () => {
    const path = makePath();
    const schedule: ScheduleItem[] = [
      { at: 'b', arrival: 'PT10M', reference_base_arrival: 'PT9M' },
    ];
    // computeTimesUpdate clearing arrival with no stop sends arrival/stop_for null
    const result = upsertScheduleItem(schedule, path, { at: 'b', arrival: null, stop_for: null });

    expect(result).toHaveLength(1);
    expect(result![0].arrival).toBeNull();
    expect(result![0].reference_base_arrival).toBe('PT9M');
  });

  it('clearing requested base arrival preserves requested arrival', () => {
    const path = makePath();
    const schedule: ScheduleItem[] = [
      { at: 'b', arrival: 'PT10M', reference_base_arrival: 'PT9M' },
    ];
    // computeReferenceBaseArrival clearing base arrival sends a partial item
    const result = upsertScheduleItem(schedule, path, { at: 'b', reference_base_arrival: null });

    expect(result).toHaveLength(1);
    expect(result![0].arrival).toBe('PT10M');
    expect(result![0].reference_base_arrival).toBeNull();
  });

  it('clearing requested base arrival preserves stop duration', () => {
    const path = makePath();
    const schedule: ScheduleItem[] = [
      { at: 'b', arrival: 'PT10M', stop_for: 'PT5M', reference_base_arrival: 'PT9M' },
    ];
    const result = upsertScheduleItem(schedule, path, { at: 'b', reference_base_arrival: null });

    expect(result).toHaveLength(1);
    expect(result![0].arrival).toBe('PT10M');
    expect(result![0].stop_for).toBe('PT5M');
    expect(result![0].reference_base_arrival).toBeNull();
  });

  it('removes a schedule item only when all relevant fields are genuinely empty', () => {
    const path = makePath();
    // Last remaining field cleared -> item removed
    expect(
      upsertScheduleItem([{ at: 'b', arrival: 'PT10M' }], path, {
        at: 'b',
        arrival: null,
        stop_for: null,
      })
    ).toEqual([]);
    // Sole reference_base_arrival cleared -> item removed
    expect(
      upsertScheduleItem([{ at: 'b', reference_base_arrival: 'PT9M' }], path, {
        at: 'b',
        reference_base_arrival: null,
      })
    ).toEqual([]);
    // Nothing to remove and nothing to add -> no patch
    expect(
      upsertScheduleItem([], path, { at: 'b', arrival: null, stop_for: null })
    ).toBeUndefined();
  });

  it('forces arrival to null on the first path step but preserves other fields', () => {
    const path = makePath();
    const schedule: ScheduleItem[] = [
      { at: 'a', arrival: 'PT0S', stop_for: 'PT5M', reference_base_arrival: 'PT1M' },
    ];
    const result = upsertScheduleItem(schedule, path, {
      at: 'a',
      arrival: 'PT10M',
      stop_for: 'PT5M',
    });

    expect(result).toHaveLength(1);
    expect(result![0].arrival).toBeNull();
    expect(result![0].stop_for).toBe('PT5M');
    expect(result![0].reference_base_arrival).toBe('PT1M');
  });
});
