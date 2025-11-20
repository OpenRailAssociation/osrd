import { describe, it, expect } from 'vitest';

import type { RoundTrips } from 'common/api/osrdEditoastApi';
import type { TimetableItem, TrainScheduleId, PacedTrainId } from 'reducers/osrdconf/types';

import { buildTimetableExportPayload } from '../utils';

const buildTrainSchedule = (id: number): TimetableItem =>
  ({
    id: `trainschedule_${id}` as TrainScheduleId,
    train_name: `Train ${id}`,
  }) as unknown as TimetableItem;

const buildPacedTrain = (id: number): TimetableItem =>
  ({
    id: `paced_${id}` as PacedTrainId,
    train_name: `Paced ${id}`,
    paced: { occurrences: [] },
  }) as unknown as TimetableItem;

describe('buildTimetableExportPayload', () => {
  it('includes forced one-way round trips for selected train schedules', () => {
    const timetableItems = [buildTrainSchedule(12)];
    const roundTrips: RoundTrips = { one_ways: [12], round_trips: [] };

    const payload = buildTimetableExportPayload(
      timetableItems,
      ['trainschedule_12' as TrainScheduleId],
      roundTrips
    );

    expect(payload.round_trips).toBeDefined();
    expect(payload.round_trips!.train_schedules).toEqual([[0, null]]);
    expect(payload.round_trips!.paced_trains).toEqual([]);
  });

  it('includes round trip indexes only when both directions are selected', () => {
    const trainA = buildTrainSchedule(21);
    const trainB = buildTrainSchedule(42);
    const roundTrips: RoundTrips = { round_trips: [[21, 42]] };

    const payloadWithBoth = buildTimetableExportPayload(
      [trainA, trainB],
      ['trainschedule_21' as TrainScheduleId, 'trainschedule_42' as TrainScheduleId],
      roundTrips
    );
    expect(payloadWithBoth.round_trips?.train_schedules).toEqual([[0, 1]]);

    const payloadWithSingle = buildTimetableExportPayload(
      [trainA],
      ['trainschedule_21' as TrainScheduleId],
      roundTrips
    );
    expect(payloadWithSingle.round_trips).toBeUndefined();
  });

  it('handles paced train one-ways', () => {
    const paced = buildPacedTrain(7);
    const payload = buildTimetableExportPayload([paced], ['paced_7' as PacedTrainId], undefined, {
      one_ways: [7],
    });

    expect(payload.round_trips?.paced_trains).toEqual([[0, null]]);
    expect(payload.round_trips?.train_schedules).toEqual([]);
  });
});
