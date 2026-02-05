import { describe, it, expect } from 'vitest';

import type { RoundTrips } from 'common/api/osrdEditoastApi';
import type { TimetableItem, PacedTrainId } from 'reducers/osrdconf/types';

import { buildTimetableExportPayload } from '../utils';

const buildPacedTrain = (id: number): TimetableItem =>
  ({
    id: `paced_${id}` as PacedTrainId,
    train_name: `Paced ${id}`,
  }) as TimetableItem;

describe('buildTimetableExportPayload', () => {
  it('includes forced one-way round trips for selected paced trains', () => {
    const timetableItems = [buildPacedTrain(12)];
    const roundTrips: RoundTrips = { one_ways: [12], round_trips: [] };

    const payload = buildTimetableExportPayload(
      timetableItems,
      ['paced_12' as PacedTrainId],
      roundTrips
    );

    expect(payload.round_trips).toEqual([[0, null]]);
  });

  it('includes round trip indexes only when both directions are selected', () => {
    const trainA = buildPacedTrain(21);
    const trainB = buildPacedTrain(42);
    const roundTrips: RoundTrips = { round_trips: [[21, 42]] };

    const payloadWithBoth = buildTimetableExportPayload(
      [trainA, trainB],
      ['paced_21' as PacedTrainId, 'paced_42' as PacedTrainId],
      roundTrips
    );
    expect(payloadWithBoth.round_trips).toEqual([[0, 1]]);

    const payloadWithSingle = buildTimetableExportPayload(
      [trainA],
      ['paced_21' as PacedTrainId],
      roundTrips
    );
    expect(payloadWithSingle.round_trips).toBeUndefined();
  });

  it('handles paced train one-ways', () => {
    const paced = buildPacedTrain(7);
    const payload = buildTimetableExportPayload([paced], ['paced_7' as PacedTrainId], {
      one_ways: [7],
    });

    expect(payload.round_trips).toEqual([[0, null]]);
  });
});
