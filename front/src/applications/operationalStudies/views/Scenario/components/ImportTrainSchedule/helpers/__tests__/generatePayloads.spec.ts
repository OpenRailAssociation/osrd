import { describe, it, expect } from 'vitest';

import { generateRoundTripsPayload } from '../generatePayloads';

describe('generateRoundTripsPayload', () => {
  it('correctly generates payload for a mix of one-ways and round-trips train schedules', () => {
    const trainSchedules = [{ id: 101 }, { id: 102 }, { id: 103 }];

    const trainScheduleIndexes: ([number, number] | [number, null])[] = [
      [0, 2],
      [1, null],
    ];

    const trainSchedulePayload = generateRoundTripsPayload(trainScheduleIndexes, trainSchedules);

    expect(trainSchedulePayload).toEqual({
      roundTrips: {
        one_ways: [102],
        round_trips: [[101, 103]],
      },
    });
  });

  const trainSchedules = [{ id: 7 }, { id: 8 }, { id: 9 }, { id: 15 }];

  it('correctly generates payload for only one-ways train schedules', () => {
    const oneWayTrainScheduleIndexes: ([number, number] | [number, null])[] = [
      [1, null],
      [0, null],
      [2, null],
      [3, null],
    ];

    const oneWayPayload = generateRoundTripsPayload(oneWayTrainScheduleIndexes, trainSchedules);

    expect(oneWayPayload).toEqual({
      roundTrips: {
        one_ways: [8, 7, 9, 15],
        round_trips: [],
      },
    });
  });

  it('correctly generates payload for only round-trips train schedules', () => {
    const roundTripsTrainScheduleIndexes: ([number, number] | [number, null])[] = [
      [1, 2],
      [0, 3],
    ];

    const roundTripsPayload = generateRoundTripsPayload(
      roundTripsTrainScheduleIndexes,
      trainSchedules
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
