import type { OccupancyZone } from '@osrd-project/ui-charts';
import { v4 as uuidV4 } from 'uuid';
import { describe, it, expect } from 'vitest';

import { Duration } from 'utils/duration';
import {
  formatEditoastIdToTrainScheduleId,
  formatEditoastIdToIndexedOccurrenceId,
} from 'utils/trainId';

import { repeatOccupancyZonesInRange, type MovableOccupancyZone } from '../zones';

function buildOccupancyZoneTimes({
  startTime,
  endTime,
}: Pick<MovableOccupancyZone, 'startTime' | 'endTime'>) {
  return {
    startTime,
    endTime,
    dbStartTime: startTime,
    dbEndTime: endTime,
  };
}

function buildOccupancyZone({
  trainId,
  startTime,
  endTime,
  paced,
}: Pick<MovableOccupancyZone, 'trainId' | 'startTime' | 'endTime' | 'paced'>): OccupancyZone &
  MovableOccupancyZone {
  return {
    pathId: 'path-' + uuidV4(),
    trackId: 'track-1',
    trainId,
    trainName: 'asdf',
    ...buildOccupancyZoneTimes({ startTime, endTime }),
    curveStyle: { color: 'red', opacity: 1 },
    exceptionTypes: [],
    pathItemRelativeLocation: { type: 'exact_path_item', path_item_id: uuidV4() },
    paced,
    blockType: 'via',
    isStop: true,
    active: false,
  };
}

describe('repeatOccupancyZonesInRange', () => {
  const timeRange = {
    start: new Duration({ minutes: 30 }),
    end: new Duration({ hours: 1, minutes: 35 }),
  };

  it('should not repeat unique trains', () => {
    const zone = buildOccupancyZone({
      trainId: formatEditoastIdToTrainScheduleId(42),
      startTime: new Duration({ minutes: 35 }).ms,
      endTime: new Duration({ minutes: 40 }).ms,
      paced: undefined,
    });

    const repeatedZones = repeatOccupancyZonesInRange([zone], timeRange);

    expect(repeatedZones).toEqual([zone]);
  });

  it('should repeat paced trains based on their time window', () => {
    const trainScheduleIdA = 42;
    const pacedA = {
      timeWindow: new Duration({ hours: 1 }),
      interval: new Duration({ minutes: 30 }),
      exceptions: [],
    };
    const zonesA = [
      buildOccupancyZone({
        trainId: formatEditoastIdToIndexedOccurrenceId({
          trainScheduleId: trainScheduleIdA,
          occurrenceIndex: 0,
        }),
        startTime: new Duration({ minutes: 20 }).ms,
        endTime: new Duration({ minutes: 25 }).ms,
        paced: pacedA,
      }),
      buildOccupancyZone({
        trainId: formatEditoastIdToIndexedOccurrenceId({
          trainScheduleId: trainScheduleIdA,
          occurrenceIndex: 1,
        }),
        startTime: new Duration({ minutes: 30 + 20 }).ms,
        endTime: new Duration({ minutes: 30 + 25 }).ms,
        paced: pacedA,
      }),
    ];

    const trainScheduleIdB = 43;
    const pacedB = {
      timeWindow: new Duration({ hours: 2 }),
      interval: new Duration({ hours: 2 }),
      exceptions: [],
    };
    const zonesB = [
      buildOccupancyZone({
        trainId: formatEditoastIdToIndexedOccurrenceId({
          trainScheduleId: trainScheduleIdB,
          occurrenceIndex: 0,
        }),
        startTime: new Duration({ hours: 1, minutes: 5 }).ms,
        endTime: new Duration({ hours: 1, minutes: 10 }).ms,
        paced: pacedB,
      }),
    ];

    const repeatedZones = repeatOccupancyZonesInRange([...zonesA, ...zonesB], timeRange);

    expect(repeatedZones).toEqual([
      zonesA[0],
      {
        ...zonesA[0],
        ...buildOccupancyZoneTimes({
          startTime: new Duration({ hours: 1, minutes: 20 }).ms,
          endTime: new Duration({ hours: 1, minutes: 25 }).ms,
        }),
      },
      {
        ...zonesA[1],
        ...buildOccupancyZoneTimes({
          startTime: new Duration({ minutes: -30 + 20 }).ms,
          endTime: new Duration({ minutes: -30 + 25 }).ms,
        }),
      },
      zonesA[1],
      {
        ...zonesA[1],
        ...buildOccupancyZoneTimes({
          startTime: new Duration({ hours: 1, minutes: 30 + 20 }).ms,
          endTime: new Duration({ hours: 1, minutes: 30 + 25 }).ms,
        }),
      },
      {
        ...zonesB[0],
        ...buildOccupancyZoneTimes({
          startTime: new Duration({ hours: -1, minutes: 5 }).ms,
          endTime: new Duration({ hours: -1, minutes: 10 }).ms,
        }),
      },
      zonesB[0],
    ]);
  });
});
