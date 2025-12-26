import { describe, expect, it } from 'vitest';

import type { RoundTrips } from 'common/api/osrdEditoastApi';
import type { PacedTrainId } from 'reducers/osrdconf/types';

import type { PairingItem } from '../types';
import { buildRoundTripsPayload } from '../utils';

describe('buildRoundTripsPayload', () => {
  const roundtrips: RoundTrips = {
    one_ways: [2],
    round_trips: [[1, 3]],
  };

  const basePairingItems: PairingItem = {
    id: 'paced_1' as PacedTrainId,
    status: 'todo',
    name: 'Train 1',
    category: null,
    origin: 'Station A',
    stops: [],
    destination: 'Station B',
    startTime: new Date(),
    requestedArrivalTime: null,
    interval: null,
  };

  it('should build payloads when all items are moved in todo', () => {
    const pairingItems: PairingItem[] = [
      basePairingItems,
      {
        ...basePairingItems,
        id: 'paced_2' as PacedTrainId,
      },
      {
        ...basePairingItems,
        id: 'paced_3' as PacedTrainId,
      },
    ];

    const { roundTripsIds, oneWaysIds, idsToDelete } = buildRoundTripsPayload(
      pairingItems,
      roundtrips
    );

    expect(roundTripsIds).toEqual([]);
    expect(oneWaysIds).toEqual([]);
    expect(idsToDelete).toEqual([1, 2, 3]);
  });
});
