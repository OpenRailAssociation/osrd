import { describe, it, expect } from 'vitest';

import { generateRoundTripsPayload } from '../generatePayloads';

describe('generateRoundTripsPayload', () => {
  it('correctly generates payload for a mix of one-ways and round-trips paced trains', () => {
    const pacedTrains = [{ id: 101 }, { id: 102 }, { id: 103 }];

    const pacedTrainIndexes: ([number, number] | [number, null])[] = [
      [0, 2],
      [1, null],
    ];

    const trainSchedulePayload = generateRoundTripsPayload(pacedTrainIndexes, pacedTrains);

    expect(trainSchedulePayload).toEqual({
      roundTrips: {
        one_ways: [102],
        round_trips: [[101, 103]],
      },
    });
  });

  const pacedTrains = [{ id: 7 }, { id: 8 }, { id: 9 }, { id: 15 }];

  it('correctly generates payload for only one-ways paced trains', () => {
    const oneWayPacedIndexes: ([number, number] | [number, null])[] = [
      [1, null],
      [0, null],
      [2, null],
      [3, null],
    ];

    const oneWayPayload = generateRoundTripsPayload(oneWayPacedIndexes, pacedTrains);

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

    const roundTripsPayload = generateRoundTripsPayload(roundTripsPacedIndexes, pacedTrains);

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
