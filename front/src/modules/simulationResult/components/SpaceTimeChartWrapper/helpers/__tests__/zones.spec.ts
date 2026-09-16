import type { OccupancyZone } from '@osrd-project/ui-charts';
import { describe, it, expect } from 'vitest';

import type { TrainScheduleId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import {
  extractTrainScheduleIdFromTrainId,
  formatEditoastIdToTrainScheduleId,
  formatTrainScheduleIdToIndexedOccurrenceId,
} from 'utils/trainId';

import { repeatOccupancyZonesInRange, type MovableOccupancyZone } from '../zones';

const HOUR_MS = 60 * 60 * 1000;

const TRAIN_A = formatEditoastIdToTrainScheduleId(1);
const TRAIN_B = formatEditoastIdToTrainScheduleId(2);

/** Build an occupancy zone of a paced train occurrence, starting at the given hour. */
const occurrenceZone = (
  trainScheduleId: TrainScheduleId,
  occurrenceIndex: number,
  startHour: number
) =>
  ({
    trainId: formatTrainScheduleIdToIndexedOccurrenceId(trainScheduleId, occurrenceIndex),
    startTime: startHour * HOUR_MS,
    endTime: startHour * HOUR_MS + 5 * 60 * 1000,
    dbStartTime: startHour * HOUR_MS,
    dbEndTime: startHour * HOUR_MS + 5 * 60 * 1000,
  }) as OccupancyZone & MovableOccupancyZone;

const range = { start: Duration.zero, end: new Duration({ hours: 4 }) };

const zonesOf = (
  zones: (OccupancyZone & MovableOccupancyZone)[],
  trainScheduleId: TrainScheduleId
) => zones.filter(({ trainId }) => extractTrainScheduleIdFromTrainId(trainId) === trainScheduleId);

describe('repeatOccupancyZonesInRange', () => {
  it('should repeat each paced train on its own time window', () => {
    const zones = [occurrenceZone(TRAIN_A, 0, 0), occurrenceZone(TRAIN_B, 0, 0)];
    const periods = new Map<TrainScheduleId, Duration>([
      [TRAIN_A, new Duration({ hours: 2 })],
      [TRAIN_B, new Duration({ hours: 1 })],
    ]);

    const result = repeatOccupancyZonesInRange(zones, periods, range);

    // One extra occurrence is kept before the range, in case it ends inside of it
    expect(zonesOf(result, TRAIN_A).map(({ startTime }) => startTime)).toEqual([
      -2 * HOUR_MS,
      0,
      2 * HOUR_MS,
    ]);
    expect(zonesOf(result, TRAIN_B).map(({ startTime }) => startTime)).toEqual([
      -1 * HOUR_MS,
      0,
      1 * HOUR_MS,
      2 * HOUR_MS,
      3 * HOUR_MS,
    ]);
  });

  it('should shift every zone of a train by the repetition offsets', () => {
    const zones = [occurrenceZone(TRAIN_A, 0, 0), occurrenceZone(TRAIN_A, 1, 1)];
    const periods = new Map<TrainScheduleId, Duration>([[TRAIN_A, new Duration({ hours: 2 })]]);

    const result = repeatOccupancyZonesInRange(zones, periods, range);

    expect(result.map(({ startTime }) => startTime)).toEqual([
      -2 * HOUR_MS,
      -1 * HOUR_MS,
      0,
      1 * HOUR_MS,
      2 * HOUR_MS,
      3 * HOUR_MS,
    ]);
    expect(result.map(({ dbStartTime }) => dbStartTime)).toEqual(
      result.map(({ startTime }) => startTime)
    );
  });

  it('should leave the zones of a train without a period as they are', () => {
    const zones = [occurrenceZone(TRAIN_A, 0, 0), occurrenceZone(TRAIN_B, 0, 0)];
    const periods = new Map<TrainScheduleId, Duration>([[TRAIN_A, new Duration({ hours: 2 })]]);

    const result = repeatOccupancyZonesInRange(zones, periods, range);

    expect(zonesOf(result, TRAIN_B)).toEqual([zones[1]]);
  });
});
