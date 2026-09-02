import { describe, it, expect } from 'vitest';

import type { Train } from 'reducers/osrdconf/types';
import { addDurationToStartTime, Duration, type StartTime } from 'utils/duration';

import type { PropagationMode, TimesStopsRowNew } from '../../types';
import {
  adjustFollowingWaypointsForMidnight,
  formatPropagationDeltaLabelByMode,
  propagateTime,
} from '../timePropagation';

// time constants

const _17H20 = new Date('2026-01-01T17:20:00.000Z');
const _17H50 = new Date('2026-01-01T17:50:00.000Z');
const _18H00 = new Date('2026-01-01T18:00:00.000Z');
const _18H10 = new Date('2026-01-01T18:10:00.000Z');
const _18H30 = new Date('2026-01-01T18:30:00.000Z');
const _18H40 = new Date('2026-01-01T18:40:00.000Z');
const _18H50 = new Date('2026-01-01T18:50:00.000Z');
const _19H00 = new Date('2026-01-01T19:00:00.000Z');
const _19H10 = new Date('2026-01-01T19:10:00.000Z');
const _19H20 = new Date('2026-01-01T19:20:00.000Z');
const _19H30 = new Date('2026-01-01T19:30:00.000Z');
// midnight crossing constants — arise when an offset crosses midnight after propagation
const _17H50_MIDNIGHT_CROSSING = new Date('2026-01-02T17:50:00.000Z');
const _18H10_MIDNIGHT_CROSSING = new Date('2026-01-02T18:10:00.000Z');
const _18H30_MIDNIGHT_CROSSING = new Date('2026-01-02T18:30:00.000Z');
const _18H50_MIDNIGHT_CROSSING = new Date('2026-01-02T18:50:00.000Z');

// Mocked train — only op11 (index 10) and op17 (index 16) have a scheduled arrival.
const makeTrain = (): Train =>
  ({
    start_time: _18H00.toISOString(),
    // op1 at index 0 through op20 at index 19
    path: Array.from({ length: 20 }, (_, i) => ({ id: `op${i + 1}`, location: {} })),
    schedule: [
      { at: 'op11', arrival: 'PT30M' }, // arrives at 18:30
      { at: 'op17', arrival: 'PT50M' }, // arrives at 18:50
    ],
  }) as unknown as Train;

/** Converts a start time and a duration offset (e.g. 'PT30M') into an absolute arrival Date. */
const toComputedArrival = (startTime: Date | Duration, offsetIso: string): StartTime =>
  addDurationToStartTime(startTime, Duration.parse(offsetIso));

// HH:mm:ss diff = 29s, but raw ms diff = 29 700ms → would round up to 30s without the fix
it('formatPropagationDeltaLabelByMode: ignores sub-second precision', () => {
  const oldValue = new Date('2024-01-01T10:00:00.200Z');
  const newValue = new Date('2024-01-01T10:00:29.900Z');
  expect(formatPropagationDeltaLabelByMode(oldValue, newValue, 'atThisWaypoint')).toBe('+00:00:29');
});

const train = makeTrain();
const row = {
  pathStepId: 'op11',
  opOnPathIndex: 10,
  requestedArrival: _18H30,
} as unknown as TimesStopsRowNew;

// Scenario 1 — +10 min at OP11 (18:30 → 18:40)
describe('Scenario 1 — +10 min at OP11', () => {
  // Delta label (shown in the propagation modal)
  describe('formatPropagationDeltaLabelByMode', () => {
    it.each<PropagationMode>([
      'atThisWaypoint',
      'toDestination',
      'fromDeparture',
      'shiftAllWaypoints',
    ])('%s — should display +00:10:00', (mode) => {
      expect(formatPropagationDeltaLabelByMode(_18H30, _18H40, mode)).toBe('+00:10:00');
    });
  });

  describe('propagateTime', () => {
    it('atThisWaypoint — should return undefined (non-origin: cell update handled outside propagateTime)', () => {
      expect(
        propagateTime(
          { field: 'requestedArrival', row, value: _18H40, propagationMode: 'atThisWaypoint' },
          train,
          'CALENDAR'
        )
      ).toBeUndefined();
    });

    it('toDestination — should leave start_time unchanged, OP11 → 18:40, OP17 → 19:00', () => {
      const result = propagateTime(
        { field: 'requestedArrival', row, value: _18H40, propagationMode: 'toDestination' },
        train,
        'CALENDAR'
      );
      expect(result).toBeDefined();
      const { updatedStartTime, updatedSchedule } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(_18H00); // start_time unchanged
      expect(scheduleByAt['op11']?.arrival).toBe('PT40M'); // 30min + 10min
      expect(scheduleByAt['op17']?.arrival).toBe('PT1H'); // 50min + 10min = PT1H
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op11'].arrival!)).toEqual(_18H40);
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op17'].arrival!)).toEqual(_19H00);
    });

    it('fromDeparture — should shift start_time → 18:10, OP11 → 18:40, OP17 stays at 18:50', () => {
      const result = propagateTime(
        { field: 'requestedArrival', row, value: _18H40, propagationMode: 'fromDeparture' },
        train,
        'CALENDAR'
      );
      expect(result).toBeDefined();
      const { updatedStartTime, updatedSchedule } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(_18H10);
      expect(scheduleByAt['op11']?.arrival).toBe('PT30M'); // offset unchanged — only steps after OP11 are shifted
      expect(scheduleByAt['op17']?.arrival).toBe('PT40M'); // 50min - 10min
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op11'].arrival!)).toEqual(_18H40);
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op17'].arrival!)).toEqual(_18H50); // same as before the edit
    });

    it('shiftAllWaypoints — should shift start_time → 18:10, all offsets unchanged, entire train +10min', () => {
      const result = propagateTime(
        { field: 'requestedArrival', row, value: _18H40, propagationMode: 'shiftAllWaypoints' },
        train,
        'CALENDAR'
      );
      expect(result).toBeDefined();
      const { updatedStartTime, updatedSchedule } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(_18H10);
      expect(scheduleByAt['op11']?.arrival).toBe('PT30M'); // offset unchanged
      expect(scheduleByAt['op17']?.arrival).toBe('PT50M'); // offset unchanged
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op11'].arrival!)).toEqual(_18H40); // 18:30 -> 18:40
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op17'].arrival!)).toEqual(_19H00); // 18:50 -> 19:00
    });
  });

  describe('adjustFollowingWaypointsForMidnight', () => {
    it('OP17 still after OP11 → should not trigger midnight crossing', () => {
      const updatedSchedule = adjustFollowingWaypointsForMidnight(_18H40, 'op11', train);
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));
      expect(scheduleByAt['op17']?.arrival).toBe('PT50M'); // 50min > 40min (OP11 new offset) → unchanged
    });
  });
});

// Scenario 2 — +30 min at OP11 (18:30 → 19:00)
describe('Scenario 2 — +30 min at OP11', () => {
  // Delta label (shown in the propagation modal)
  describe('formatPropagationDeltaLabelByMode', () => {
    it.each<PropagationMode>([
      'atThisWaypoint',
      'toDestination',
      'fromDeparture',
      'shiftAllWaypoints',
    ])('%s — should display +00:30:00', (mode) => {
      expect(formatPropagationDeltaLabelByMode(_18H30, _19H00, mode)).toBe('+00:30:00');
    });
  });

  describe('propagateTime', () => {
    it('atThisWaypoint — should return undefined (non-origin: cell update handled outside propagateTime)', () => {
      expect(
        propagateTime(
          { field: 'requestedArrival', row, value: _19H00, propagationMode: 'atThisWaypoint' },
          train,
          'CALENDAR'
        )
      ).toBeUndefined();
    });

    it('toDestination — should leave start_time unchanged, OP11 → 19:00, OP17 → 19:20', () => {
      const result = propagateTime(
        { field: 'requestedArrival', row, value: _19H00, propagationMode: 'toDestination' },
        train,
        'CALENDAR'
      );
      expect(result).toBeDefined();
      const { updatedStartTime, updatedSchedule } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(_18H00); // start_time unchanged
      expect(scheduleByAt['op11']?.arrival).toBe('PT1H'); // 30min + 30min = PT1H
      expect(scheduleByAt['op17']?.arrival).toBe('PT1H20M'); // 50min + 30min = PT1H20M
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op11'].arrival!)).toEqual(_19H00);
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op17'].arrival!)).toEqual(_19H20);
    });

    it('fromDeparture — should shift start_time → 18:30, OP11 → 19:00, OP17 midnight crossing → next day 18:50', () => {
      const result = propagateTime(
        { field: 'requestedArrival', row, value: _19H00, propagationMode: 'fromDeparture' },
        train,
        'CALENDAR'
      );
      expect(result).toBeDefined();
      const { updatedStartTime, updatedSchedule } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(_18H30);
      expect(scheduleByAt['op11']?.arrival).toBe('PT30M'); // offset unchanged — only steps after OP11 are shifted
      expect(scheduleByAt['op17']?.arrival).toBe('PT24H20M'); // 50min - 30min = 20min < 30min (OP11 offset) → midnight crossing
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op11'].arrival!)).toEqual(_19H00);
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op17'].arrival!)).toEqual(
        _18H50_MIDNIGHT_CROSSING
      );
    });

    it('shiftAllWaypoints — should shift start_time → 18:30, all offsets unchanged, entire train +30min', () => {
      const result = propagateTime(
        { field: 'requestedArrival', row, value: _19H00, propagationMode: 'shiftAllWaypoints' },
        train,
        'CALENDAR'
      );
      expect(result).toBeDefined();
      const { updatedStartTime, updatedSchedule } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(_18H30);
      expect(scheduleByAt['op11']?.arrival).toBe('PT30M'); // offset unchanged
      expect(scheduleByAt['op17']?.arrival).toBe('PT50M'); // offset unchanged
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op11'].arrival!)).toEqual(_19H00);
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op17'].arrival!)).toEqual(_19H20);
    });
  });

  describe('adjustFollowingWaypointsForMidnight', () => {
    it('OP17 falls before OP11 → should trigger midnight crossing to next day 18:50', () => {
      const updatedSchedule = adjustFollowingWaypointsForMidnight(_19H00, 'op11', train);
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));
      expect(scheduleByAt['op17']?.arrival).toBe('PT24H50M'); // 50min < 60min (OP11 new offset) → midnight crossing (+24h to original offset)
      expect(toComputedArrival(_18H00, scheduleByAt['op17'].arrival!)).toEqual(
        _18H50_MIDNIGHT_CROSSING
      );
    });
  });
});

// Scenario 3 — -40 min at OP11 (typed 17:50, was 18:30)
describe('Scenario 3 — -40 min at OP11', () => {
  // Delta label (shown in the propagation modal)
  // atThisWaypoint/toDestination → +23:20:00
  // fromDeparture/shiftAllWaypoints → -00:40:00
  describe('formatPropagationDeltaLabelByMode', () => {
    it.each<PropagationMode>(['atThisWaypoint', 'toDestination'])(
      '%s — should display +23:20:00',
      (mode) => {
        expect(formatPropagationDeltaLabelByMode(_18H30, _17H50_MIDNIGHT_CROSSING, mode)).toBe(
          '+23:20:00'
        );
      }
    );
    it.each<PropagationMode>(['fromDeparture', 'shiftAllWaypoints'])(
      '%s — should display -00:40:00',
      (mode) => {
        expect(formatPropagationDeltaLabelByMode(_18H30, _17H50_MIDNIGHT_CROSSING, mode)).toBe(
          '-00:40:00'
        );
      }
    );
  });

  describe('propagateTime', () => {
    it('atThisWaypoint — should return undefined (non-origin: cell update handled outside propagateTime)', () => {
      expect(
        propagateTime(
          {
            field: 'requestedArrival',
            row,
            value: _17H50_MIDNIGHT_CROSSING,
            propagationMode: 'atThisWaypoint',
          },
          train,
          'CALENDAR'
        )
      ).toBeUndefined();
    });

    it('toDestination — should leave start_time unchanged, OP11 → next day 17:50, OP17 → next day 18:10', () => {
      const result = propagateTime(
        {
          field: 'requestedArrival',
          row,
          value: _17H50_MIDNIGHT_CROSSING,
          propagationMode: 'toDestination',
        },
        train,
        'CALENDAR'
      );
      expect(result).toBeDefined();
      const { updatedStartTime, updatedSchedule } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(_18H00); // start_time unchanged
      expect(scheduleByAt['op11']?.arrival).toBe('PT23H50M'); // 30min + 23h20m
      expect(scheduleByAt['op17']?.arrival).toBe('PT24H10M'); // 50min + 23h20m = 24h10m
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op11'].arrival!)).toEqual(
        _17H50_MIDNIGHT_CROSSING
      );
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op17'].arrival!)).toEqual(
        _18H10_MIDNIGHT_CROSSING
      );
    });

    it('fromDeparture — should shift start_time → 17:20, OP11 → 17:50, OP17 stays at 18:50', () => {
      const result = propagateTime(
        {
          field: 'requestedArrival',
          row,
          value: _17H50_MIDNIGHT_CROSSING,
          propagationMode: 'fromDeparture',
        },
        train,
        'CALENDAR'
      );
      expect(result).toBeDefined();
      const { updatedStartTime, updatedSchedule } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(_17H20);
      expect(scheduleByAt['op11']?.arrival).toBe('PT30M'); // offset unchanged — only steps after OP11 are shifted
      expect(scheduleByAt['op17']?.arrival).toBe('PT1H30M'); // 50min - (-40min) = 90min, no midnight crossing
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op11'].arrival!)).toEqual(_17H50);
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op17'].arrival!)).toEqual(_18H50); // same as before the edit
    });

    it('shiftAllWaypoints — should shift start_time → 17:20, all offsets unchanged, entire train -40min', () => {
      const result = propagateTime(
        {
          field: 'requestedArrival',
          row,
          value: _17H50_MIDNIGHT_CROSSING,
          propagationMode: 'shiftAllWaypoints',
        },
        train,
        'CALENDAR'
      );
      expect(result).toBeDefined();
      const { updatedStartTime, updatedSchedule } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(_17H20);
      expect(scheduleByAt['op11']?.arrival).toBe('PT30M'); // offset unchanged
      expect(scheduleByAt['op17']?.arrival).toBe('PT50M'); // offset unchanged
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op11'].arrival!)).toEqual(_17H50); // 18:30 -> 17:50
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op17'].arrival!)).toEqual(_18H10); // 18:50 -> 18:10
    });
  });

  describe('adjustFollowingWaypointsForMidnight', () => {
    it('OP17 falls before OP11 → should trigger midnight crossing to next day 18:50', () => {
      const updatedSchedule = adjustFollowingWaypointsForMidnight(
        _17H50_MIDNIGHT_CROSSING,
        'op11',
        train
      );
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));
      expect(scheduleByAt['op17']?.arrival).toBe('PT24H50M'); // 50min < 23h50m (OP11 new offset) → midnight crossing
      expect(toComputedArrival(_18H00, scheduleByAt['op17'].arrival!)).toEqual(
        _18H50_MIDNIGHT_CROSSING
      );
    });
  });
});

// Scenario 4 — +40 min at origin (OP1)
// At origin, each mode behaves differently from the non-origin case.
// +40min causes OP11's offset to go negative (30min - 40min) → midnight crossing for atThisWaypoint.
describe('Scenario 4 — +40 min at origin (OP1)', () => {
  const originRow = {
    pathStepId: 'op1',
    opOnPathIndex: 0,
    requestedArrival: _18H00,
  } as unknown as TimesStopsRowNew;

  // At origin, all modes use HH:mm delta regardless of mode (isOriginArrival = true).
  describe('formatPropagationDeltaLabelByMode', () => {
    it.each<PropagationMode>([
      'atThisWaypoint',
      'toDestination',
      'fromDeparture',
      'shiftAllWaypoints',
    ])('%s — should display +00:40:00', (mode) => {
      expect(formatPropagationDeltaLabelByMode(_18H00, _18H40, mode, true)).toBe('+00:40:00');
    });
  });

  describe('propagateTime', () => {
    // atThisWaypoint at origin shifts start_time only.
    // OP11: 30min - 40min = -10min → midnight crossing → PT23H50M.
    // OP17: 50min - 40min = 10min → midnight crossing → PT24H10M.
    it('atThisWaypoint — should shift start_time → 18:40, OP11 and OP17 midnight crossing, absolute times preserved', () => {
      const result = propagateTime(
        {
          field: 'requestedArrival',
          row: originRow,
          value: _18H40,
          propagationMode: 'atThisWaypoint',
        },
        train,
        'CALENDAR'
      );
      expect(result).toBeDefined();
      const { updatedStartTime, updatedSchedule } = result!;
      const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

      expect(updatedStartTime).toEqual(_18H40);
      expect(scheduleByAt['op11']?.arrival).toBe('PT23H50M'); // 30min - 40min = -10min → midnight crossing
      expect(scheduleByAt['op17']?.arrival).toBe('PT24H10M'); // 10min < PT23H50M (cascade) → midnight crossing
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op11'].arrival!)).toEqual(
        _18H30_MIDNIGHT_CROSSING
      );
      expect(toComputedArrival(updatedStartTime, scheduleByAt['op17'].arrival!)).toEqual(
        _18H50_MIDNIGHT_CROSSING
      );
    });

    it('fromDeparture — should return undefined (not applicable at origin)', () => {
      expect(
        propagateTime(
          {
            field: 'requestedArrival',
            row: originRow,
            value: _18H40,
            propagationMode: 'fromDeparture',
          },
          train,
          'CALENDAR'
        )
      ).toBeUndefined();
    });

    // At origin, toDestination and shiftAllWaypoints both call propagateShiftAll — same result.
    it.each<PropagationMode>(['toDestination', 'shiftAllWaypoints'])(
      '%s — should shift start_time → 18:40, all offsets unchanged, entire train +40min',
      (mode) => {
        const result = propagateTime(
          { field: 'requestedArrival', row: originRow, value: _18H40, propagationMode: mode },
          train,
          'CALENDAR'
        );
        expect(result).toBeDefined();
        const { updatedStartTime, updatedSchedule } = result!;
        const scheduleByAt = Object.fromEntries(updatedSchedule.map((item) => [item.at, item]));

        expect(updatedStartTime).toEqual(_18H40);
        expect(scheduleByAt['op11']?.arrival).toBe('PT30M'); // offset unchanged
        expect(scheduleByAt['op17']?.arrival).toBe('PT50M'); // offset unchanged
        expect(toComputedArrival(updatedStartTime, scheduleByAt['op11'].arrival!)).toEqual(_19H10);
        expect(toComputedArrival(updatedStartTime, scheduleByAt['op17'].arrival!)).toEqual(_19H30);
      }
    );
  });
});
