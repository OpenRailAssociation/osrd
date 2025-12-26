import { describe, it, expect } from 'vitest';

import type { PacedTrainId } from 'reducers/osrdconf/types';
import { extractEditoastIdFromPacedTrainId } from 'utils/trainId';

import { generateRoundTripsPayload } from '../generatePayloads';

describe('generateRoundTripsPayload', () => {
  it('correctly generates payload for a mix of one-ways and round-trips paced trains', () => {
    const pacedTrains = [
      { id: 'paced_101' as PacedTrainId },
      { id: 'paced_102' as PacedTrainId },
      { id: 'paced_103' as PacedTrainId },
    ];

    const pacedTrainIndexes: ([number, number] | [number, null])[] = [
      [0, 2],
      [1, null],
    ];

    const trainSchedulePayload = generateRoundTripsPayload(
      pacedTrainIndexes,
      pacedTrains,
      extractEditoastIdFromPacedTrainId
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
