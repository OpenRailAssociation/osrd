import { describe, it, expect } from 'vitest';

import type { Train } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import type { TimesStopsRowNew } from '../../types';
import { formatStopDurationDeltaLabel, propagateStopDuration } from '../stopDurationPropagation';

const _18H00 = new Date('2026-01-01T18:00:00.000Z');

// Mocked train — op5 (index 4) and op17 (index 16) have a scheduled arrival.
// op11 (index 10, the edited point) has an arrival + a stop duration, unless stated otherwise.
const makeTrain = (op11StopFor: string): Train =>
  ({
    start_time: _18H00.toISOString(),
    path: Array.from({ length: 20 }, (_, i) => ({ key: `op${i + 1}`, location: {} })),
    schedule: [
      { at: 'op5', arrival: 'PT15M' },
      { at: 'op11', arrival: 'PT30M', stop_for: op11StopFor },
      { at: 'op17', arrival: 'PT50M' },
    ],
  }) as unknown as Train;

// Same as makeTrain, but op11 has no schedule entry at all (a brand new stop is being created).
const makeTrainWithoutOp11 = (): Train =>
  ({
    start_time: _18H00.toISOString(),
    path: Array.from({ length: 20 }, (_, i) => ({ key: `op${i + 1}`, location: {} })),
    schedule: [
      { at: 'op5', arrival: 'PT15M' },
      { at: 'op17', arrival: 'PT50M' },
    ],
  }) as unknown as Train;

const makeRow = (stopDurationIso: string | null): TimesStopsRowNew =>
  ({
    pathStepId: 'op11',
    opOnPathIndex: 10,
    stopDuration: stopDurationIso ? Duration.parse(stopDurationIso) : null,
  }) as unknown as TimesStopsRowNew;

describe('formatStopDurationDeltaLabel', () => {
  it('computes a signed delta between old and new duration', () => {
    expect(formatStopDurationDeltaLabel(Duration.parse('PT5M'), Duration.parse('PT15M'))).toBe(
      '+00:10:00'
    );
  });

  it('treats a missing value as 0', () => {
    expect(formatStopDurationDeltaLabel(null, Duration.parse('PT5M'))).toBe('+00:05:00');
  });
});

describe('propagateStopDuration', () => {
  it('atThisWaypoint or an unanchored row returns undefined', () => {
    const train = makeTrain('PT5M');
    expect(
      propagateStopDuration(
        {
          row: makeRow('PT5M'),
          field: 'stopDuration',
          value: 900,
          propagationMode: 'atThisWaypoint',
        },
        train
      )
    ).toBeUndefined();
    expect(
      propagateStopDuration(
        {
          row: { ...makeRow('PT5M'), pathStepId: null },
          field: 'stopDuration',
          value: 900,
          propagationMode: 'toDestination',
        },
        train
      )
    ).toBeUndefined();
  });

  it('toDestination — OP17 (after) shifts, OP11 arrival stays put', () => {
    const train = makeTrain('PT5M');
    const row = makeRow('PT5M');
    const result = propagateStopDuration(
      { row, field: 'stopDuration', value: 900, propagationMode: 'toDestination' }, // +10min
      train
    );
    expect(result).toBeDefined();
    const { updatedSchedule, updatedStartTime } = result!;
    const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

    expect(updatedStartTime).toEqual(_18H00);
    expect(scheduleByAt.op11?.arrival).toBe('PT30M'); // unchanged
    expect(scheduleByAt.op11?.stop_for).toBe('PT15M');
    expect(scheduleByAt.op17?.arrival).toBe('PT1H'); // 50min + 10min
  });

  describe('fromDeparture', () => {
    // Regression check: start_time must shift, not the preceding schedule entries themselves.
    it('+5min — start_time → 17:55, OP11/OP5 stored offsets untouched, OP17 compensated to PT55M', () => {
      const train = makeTrain('PT5M');
      const row = makeRow('PT5M');
      const result = propagateStopDuration(
        { row, field: 'stopDuration', value: 600, propagationMode: 'fromDeparture' }, // +5min
        train
      );
      expect(result).toBeDefined();
      const { updatedSchedule, updatedStartTime } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(new Date('2026-01-01T17:55:00.000Z')); // 18:00 - 5min
      expect(scheduleByAt.op11?.arrival).toBe('PT30M'); // stored offset untouched
      expect(scheduleByAt.op5?.arrival).toBe('PT15M'); // before the edited point, untouched
      expect(scheduleByAt.op17?.arrival).toBe('PT55M'); // 50min + 5min, cancels out the start_time shift
    });

    // Regression check: works even when the edited point isn't horairisé (no requested arrival).
    it('no requested arrival on the edited point — start_time still shifts', () => {
      const train = makeTrainWithoutOp11();
      const row = makeRow(null);
      const result = propagateStopDuration(
        { row, field: 'stopDuration', value: 600, propagationMode: 'fromDeparture' }, // +10min
        train
      );
      expect(result).toBeDefined();
      const { updatedSchedule, updatedStartTime } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(new Date('2026-01-01T17:50:00.000Z')); // 18:00 - 10min
      expect(scheduleByAt.op11?.stop_for).toBe('PT10M');
      expect(scheduleByAt.op11?.arrival).toBeUndefined();
      expect(scheduleByAt.op17?.arrival).toBe('PT1H'); // 50min + 10min
    });
  });
});
