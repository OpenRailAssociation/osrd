import { describe, it, expect } from 'vitest';

import type { TrainScheduleId, PacedTrainId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromTrainScheduleId,
  extractEditoastIdFromPacedTrainId,
} from 'utils/trainId';

import { generateRoundTripsPayload } from '../generatePayloads';

describe('generateRoundTripsPayload', () => {
  it('correctly generates payload for a mix of one-ways and round-trips train schedules', () => {
    const trainSchedules = [
      { id: 'trainschedule_101' as TrainScheduleId },
      { id: 'trainschedule_102' as TrainScheduleId },
      { id: 'trainschedule_103' as TrainScheduleId },
    ];

    const trainScheduleIndexes: ([number, number] | [number, null])[] = [
      [0, 2],
      [1, null],
    ];

    const trainSchedulePayload = generateRoundTripsPayload(
      trainScheduleIndexes,
      trainSchedules,
      extractEditoastIdFromTrainScheduleId
    );

    expect(trainSchedulePayload).toEqual({
      roundTrips: {
        one_ways: [102],
        round_trips: [[101, 103]],
      },
    });
  });

  const pacedTrains = [
    { id: 'paced_7' as PacedTrainId },
    { id: 'paced_8' as PacedTrainId },
    { id: 'paced_9' as PacedTrainId },
    { id: 'paced_15' as PacedTrainId },
  ];

  it('correctly generates payload for only one-ways paced trains', () => {
    const oneWayPacedIndexes: ([number, number] | [number, null])[] = [
      [1, null],
      [0, null],
      [2, null],
      [3, null],
    ];

    const oneWayPayload = generateRoundTripsPayload(
      oneWayPacedIndexes,
      pacedTrains,
      extractEditoastIdFromPacedTrainId
    );

    expect(oneWayPayload).toEqual({
      roundTrips: {
        one_ways: [8, 7, 9, 15],
        round_trips: [],
      },
    });
  });

  it('correctly generates payload for only round-trips paced trains', () => {
    const roundTripsPacedIndexes: ([number, number] | [number, null])[] = [
      [1, 2],
      [0, 3],
    ];

    const roundTripsPayload = generateRoundTripsPayload(
      roundTripsPacedIndexes,
      pacedTrains,
      extractEditoastIdFromPacedTrainId
    );

    expect(roundTripsPayload).toEqual({
      roundTrips: {
        one_ways: [],
        round_trips: [
          [8, 9],
          [7, 15],
        ],
      },
    });
  });
});
