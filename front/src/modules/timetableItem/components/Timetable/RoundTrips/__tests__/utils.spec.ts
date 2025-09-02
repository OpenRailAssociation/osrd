import { describe, expect, it } from 'vitest';

import type { RoundTrips } from 'common/api/osrdEditoastApi';
import type { PacedTrainId, TrainScheduleId } from 'reducers/osrdconf/types';

import type { PairingItem } from '../types';
import { buildRoundTripsPayload } from '../utils';

describe('buildRoundTripsPayload', () => {
  const trainScheduleRoundtrips: RoundTrips = {
    one_ways: [1],
    round_trips: [[2, 3]],
  };
  const pacedTrainRoundtrips: RoundTrips = {
    one_ways: [2],
    round_trips: [[1, 3]],
  };

  const basePairingItems: PairingItem = {
    id: 'trainschedule_1' as TrainScheduleId,
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
        id: 'trainschedule_2' as TrainScheduleId,
      },
      {
        ...basePairingItems,
        id: 'trainschedule_3' as TrainScheduleId,
      },
      {
        ...basePairingItems,
        id: 'paced_1' as PacedTrainId,
      },
      {
        ...basePairingItems,
        id: 'paced_2' as PacedTrainId,
      },
      {
        ...basePairingItems,
        id: 'paced_3' as PacedTrainId,
      },
    ];

    const {
      trainScheduleRoundTripsIds,
      pacedTrainRoundTripsIds,
      trainScheduleOneWaysIds,
      pacedTrainOneWaysIds,
      trainScheduleIdsToDelete,
      pacedTrainIdsToDelete,
    } = buildRoundTripsPayload(pairingItems, trainScheduleRoundtrips, pacedTrainRoundtrips);

    expect(trainScheduleRoundTripsIds).toEqual([]);
    expect(trainScheduleOneWaysIds).toEqual([]);
    expect(trainScheduleIdsToDelete).toEqual([1, 2, 3]);
    expect(pacedTrainRoundTripsIds).toEqual([]);
    expect(pacedTrainOneWaysIds).toEqual([]);
    expect(pacedTrainIdsToDelete).toEqual([1, 2, 3]);
  });

  it('should build payload for items are mixed', () => {
    const pairingItems: PairingItem[] = [
      {
        ...basePairingItems,
        id: 'trainschedule_2' as TrainScheduleId,
      },
      {
        ...basePairingItems,
        id: 'trainschedule_1' as TrainScheduleId,
        status: 'roundTrips',
        isValidPair: true,
        pairedItemId: 'trainschedule_3' as TrainScheduleId,
      },
      {
        ...basePairingItems,
        id: 'trainschedule_3' as TrainScheduleId,
        status: 'roundTrips',
        isValidPair: true,
        pairedItemId: 'trainschedule_1' as TrainScheduleId,
      },
      {
        ...basePairingItems,
        id: 'paced_1' as PacedTrainId,
        status: 'roundTrips',
        isValidPair: false,
        pairedItemId: 'paced_2' as PacedTrainId,
      },
      {
        ...basePairingItems,
        id: 'paced_2' as PacedTrainId,
        status: 'roundTrips',
        isValidPair: false,
        pairedItemId: 'paced_1' as PacedTrainId,
      },
      {
        ...basePairingItems,
        id: 'paced_3' as PacedTrainId,
        status: 'oneWays',
      },
    ];

    const {
      trainScheduleRoundTripsIds,
      pacedTrainRoundTripsIds,
      trainScheduleOneWaysIds,
      pacedTrainOneWaysIds,
      trainScheduleIdsToDelete,
      pacedTrainIdsToDelete,
    } = buildRoundTripsPayload(pairingItems, trainScheduleRoundtrips, pacedTrainRoundtrips);

    expect(trainScheduleRoundTripsIds).toEqual([[1, 3]]);
    expect(trainScheduleOneWaysIds).toEqual([]);
    expect(trainScheduleIdsToDelete).toEqual([2]);
    expect(pacedTrainRoundTripsIds).toEqual([[2, 1]]);
    expect(pacedTrainOneWaysIds).toEqual([3]);
    expect(pacedTrainIdsToDelete).toEqual([]);
  });
});
