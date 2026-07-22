import { describe, it, expect } from 'vitest';

import type { Train } from 'reducers/osrdconf/types';
import { addDurationToDate, Duration } from 'utils/duration';

import type { TimesStopsRowNew } from '../../types';
import { formatStopDurationDeltaLabel, propagateStopDuration } from '../stopDurationPropagation';

const _18H00 = new Date('2026-01-01T18:00:00.000Z');

// Mocked train — op5 (index 4) and op17 (index 16) have a scheduled arrival.
// op11 (index 10, the edited point) has an arrival + a stop duration, unless stated otherwise.
const makeTrain = (op11StopFor: string): Train =>
  ({
    start_time: _18H00.toISOString(),
    path: Array.from({ length: 20 }, (_, i) => ({ id: `op${i + 1}`, location: {} })),
    schedule: [
      { at: 'op5', arrival: 'PT15M' }, // arrives 18:15
      { at: 'op11', arrival: 'PT30M', stop_for: op11StopFor }, // arrives 18:30
      { at: 'op17', arrival: 'PT50M' }, // arrives 18:50
    ],
  }) as unknown as Train;

// Same as makeTrain, but op11 has no schedule entry at all (a brand new stop is being created).
const makeTrainWithoutOp11 = (): Train =>
  ({
    start_time: _18H00.toISOString(),
    path: Array.from({ length: 20 }, (_, i) => ({ id: `op${i + 1}`, location: {} })),
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

const toComputedArrival = (startTime: Date, offsetIso: string): Date =>
  addDurationToDate(startTime, Duration.parse(offsetIso));

describe('formatStopDurationDeltaLabel', () => {
  it('computes a positive delta', () => {
    expect(formatStopDurationDeltaLabel(Duration.parse('PT5M'), Duration.parse('PT15M'))).toBe(
      '+00:10:00'
    );
  });

  it('computes a negative delta', () => {
    expect(formatStopDurationDeltaLabel(Duration.parse('PT15M'), Duration.parse('PT5M'))).toBe(
      '-00:10:00'
    );
  });

  it('treats a missing old value as 0 (adding a stop where none existed)', () => {
    expect(formatStopDurationDeltaLabel(null, Duration.parse('PT5M'))).toBe('+00:05:00');
  });

  it('treats a missing new value as 0 (clearing a stop)', () => {
    expect(formatStopDurationDeltaLabel(Duration.parse('PT5M'), null)).toBe('-00:05:00');
  });
});

describe('propagateStopDuration', () => {
  it('atThisWaypoint — returns undefined (handled by the generic single-row edit path)', () => {
    const train = makeTrain('PT5M');
    const row = makeRow('PT5M');
    expect(
      propagateStopDuration(
        { row, field: 'stopDuration', value: 900, propagationMode: 'atThisWaypoint' },
        train
      )
    ).toBeUndefined();
  });

  it('returns undefined when the row is not yet anchored to a path step', () => {
    const train = makeTrain('PT5M');
    const row = { ...makeRow('PT5M'), pathStepId: null } as unknown as TimesStopsRowNew;
    expect(
      propagateStopDuration(
        { row, field: 'stopDuration', value: 900, propagationMode: 'toDestination' },
        train
      )
    ).toBeUndefined();
  });

  describe('toDestination', () => {
    it('+10min — OP17 (after) shifts, OP5 (before) and OP11 arrival untouched', () => {
      const train = makeTrain('PT5M');
      const row = makeRow('PT5M');
      const result = propagateStopDuration(
        { row, field: 'stopDuration', value: 900, propagationMode: 'toDestination' }, // 900s = 15min
        train
      );
      expect(result).toBeDefined();
      const { updatedSchedule, updatedStartTime } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(_18H00);
      expect(scheduleByAt.op11?.arrival).toBe('PT30M'); // unchanged
      expect(scheduleByAt.op11?.stop_for).toBe('PT15M'); // new duration
      expect(scheduleByAt.op5?.arrival).toBe('PT15M'); // untouched (before edited point)
      expect(scheduleByAt.op17?.arrival).toBe('PT1H'); // 50min + 10min
      expect(toComputedArrival(updatedStartTime, scheduleByAt.op17.arrival!)).toEqual(
        new Date('2026-01-01T19:00:00.000Z')
      );
    });

    it('large decrease — OP17 falls before OP11 and is bumped +24h', () => {
      const train = makeTrain('PT45M');
      const row = makeRow('PT45M');
      const result = propagateStopDuration(
        { row, field: 'stopDuration', value: 300, propagationMode: 'toDestination' }, // 300s = 5min
        train
      );
      expect(result).toBeDefined();
      const { updatedSchedule } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(scheduleByAt.op11?.arrival).toBe('PT30M'); // unchanged
      expect(scheduleByAt.op11?.stop_for).toBe('PT5M');
      // 50min - 40min = 10min < 30min (OP11's unchanged offset) -> bumped +24h
      expect(scheduleByAt.op17?.arrival).toBe('PT24H10M');
    });

    it('creating a brand-new stop duration inserts a schedule entry and still propagates forward', () => {
      const train = makeTrainWithoutOp11();
      const row = makeRow(null);
      const result = propagateStopDuration(
        { row, field: 'stopDuration', value: 600, propagationMode: 'toDestination' }, // 600s = 10min
        train
      );
      expect(result).toBeDefined();
      const { updatedSchedule } = result!;
      const order = updatedSchedule.map((item) => item.at);

      expect(order.indexOf('op5')).toBeLessThan(order.indexOf('op11'));
      expect(order.indexOf('op11')).toBeLessThan(order.indexOf('op17'));

      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));
      expect(scheduleByAt.op11?.stop_for).toBe('PT10M');
      expect(scheduleByAt.op11?.arrival).toBeUndefined();
      expect(scheduleByAt.op5?.arrival).toBe('PT15M'); // untouched
      expect(scheduleByAt.op17?.arrival).toBe('PT1H'); // 50min + 10min
    });
  });

  describe('fromDeparture', () => {
    it('+10min — OP11 and OP5 (before) shift back, OP17 (after) untouched, departure unchanged', () => {
      const train = makeTrain('PT5M');
      const row = makeRow('PT5M');
      const result = propagateStopDuration(
        { row, field: 'stopDuration', value: 900, propagationMode: 'fromDeparture' }, // 900s = 15min
        train
      );
      expect(result).toBeDefined();
      const { updatedSchedule, updatedStartTime } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(_18H00);
      expect(scheduleByAt.op11?.arrival).toBe('PT20M'); // 30min - 10min
      expect(scheduleByAt.op11?.stop_for).toBe('PT15M');
      expect(scheduleByAt.op5?.arrival).toBe('PT5M'); // 15min - 10min
      expect(scheduleByAt.op17?.arrival).toBe('PT50M'); // untouched, after the edited point

      // Departure stays the same: new arrival (18:20) + new duration (15min) = 18:35,
      // same as the original arrival (18:30) + original duration (5min).
      const newDeparture = addDurationToDate(
        toComputedArrival(updatedStartTime, scheduleByAt.op11.arrival!),
        Duration.parse(scheduleByAt.op11.stop_for!)
      );
      expect(newDeparture).toEqual(new Date('2026-01-01T18:35:00.000Z'));
    });

    it('no requested arrival on the edited point — preceding arrivals still shift, none added', () => {
      const train = makeTrainWithoutOp11();
      const row = makeRow(null);
      const result = propagateStopDuration(
        { row, field: 'stopDuration', value: 600, propagationMode: 'fromDeparture' }, // 600s = 10min
        train
      );
      expect(result).toBeDefined();
      const { updatedSchedule } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(scheduleByAt.op11?.stop_for).toBe('PT10M');
      expect(scheduleByAt.op11?.arrival).toBeUndefined();
      expect(scheduleByAt.op5?.arrival).toBe('PT5M'); // 15min - 10min
      expect(scheduleByAt.op17?.arrival).toBe('PT50M'); // untouched, after the edited point
    });
  });
});
