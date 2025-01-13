import type { TFunction } from 'i18next';
import { describe, it, expect } from 'vitest';

import {
  pathInputsEndingWithTwoWaypointsByMap,
  pathInputsWithNoMapWaypoint,
  pathInputsWithOneMapWaypoint,
  pathInputWithWaypointsByMapOnly,
  sampleWithMultipleOperationalPoints,
  sampleWithOneOperationalPoint,
} from './sampleData';
import { upsertMapWaypointsInOperationalPoints } from '../helpers/upsertMapWaypointsInOperationalPoints';

const tMock = ((key: string) => key) as TFunction;

describe('upsertMapWaypointsInOperationalPoints', () => {
  it('should add waypoints at the good position in a path with operational points', () => {
    const pathItemPositions = [0, 9246000, 26500000];

    const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
      pathInputsWithOneMapWaypoint,
      pathItemPositions,
      sampleWithMultipleOperationalPoints,
      tMock
    );

    expect(operationalPointsWithAllWaypoints).toEqual([
      {
        id: 'West_station',
        part: {
          track: 'TA1',
          position: 500,
        },
        extensions: {
          identifier: {
            name: 'West_station',
            uic: 2,
          },
        },
        position: 0,
        weight: null,
      },
      {
        id: '2',
        extensions: {
          identifier: {
            name: 'requestedPoint',
            uic: 0,
          },
        },
        part: {
          track: 'TA6',
          position: 7746000,
        },
        position: 9246000,
        weight: 100,
      },
      {
        id: 'Mid_West_station',
        part: {
          track: 'TC1',
          position: 550,
        },
        extensions: {
          identifier: {
            name: 'Mid_West_station',
            uic: 3,
          },
        },
        position: 12050000,
        weight: null,
      },
      {
        id: 'Mid_East_station',
        part: {
          track: 'TD0',
          position: 14000,
        },
        extensions: {
          identifier: {
            name: 'Mid_East_station',
            uic: 4,
          },
        },
        position: 26500000,
        weight: null,
      },
    ]);
  });

  it('should add waypoints properly even when the last two come from map clicks', () => {
    const pathItemPositions = [0, 4198000, 4402000];

    const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
      pathInputsEndingWithTwoWaypointsByMap,
      pathItemPositions,
      sampleWithOneOperationalPoint,
      tMock
    );

    expect(operationalPointsWithAllWaypoints).toEqual([
      {
        id: '1',
        extensions: {
          identifier: {
            name: 'requestedPoint',
            uic: 0,
          },
        },
        part: {
          track: 'TA6',
          position: 6481000,
        },
        position: 0,
        weight: 100,
      },
      {
        id: 'Mid_West_station',
        part: {
          track: 'TC0',
          position: 550,
        },
        extensions: {
          identifier: {
            name: 'Mid_West_station',
            uic: 3,
          },
        },
        position: 4069000,
        weight: null,
      },
      {
        id: '2',
        extensions: {
          identifier: {
            name: 'requestedPoint',
            uic: 0,
          },
        },
        part: {
          track: 'TC0',
          position: 679000,
        },
        position: 4198000,
        weight: 100,
      },
      {
        id: '3',
        extensions: {
          identifier: {
            name: 'requestedPoint',
            uic: 0,
          },
        },
        part: {
          track: 'TC0',
          position: 883000,
        },
        position: 4402000,
        weight: 100,
      },
    ]);
  });

  it('should add waypoints properly when there is no op on path', () => {
    const pathItemPositions = [0, 1748000];

    const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
      pathInputWithWaypointsByMapOnly,
      pathItemPositions,
      [],
      tMock
    );

    expect(operationalPointsWithAllWaypoints).toEqual([
      {
        id: '1',
        extensions: {
          identifier: {
            name: 'requestedPoint',
            uic: 0,
          },
        },
        part: {
          track: 'TA6',
          position: 6481000,
        },
        position: 0,
        weight: 100,
      },
      {
        id: '2',
        extensions: {
          identifier: {
            name: 'requestedPoint',
            uic: 0,
          },
        },
        part: {
          track: 'TA6',
          position: 4733000,
        },
        position: 1748000,
        weight: 100,
      },
    ]);
  });

  it('should return the same array if there is no waypoints added by map click', () => {
    const pathItemPositions = [0, 12050000, 26500000];

    const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
      pathInputsWithNoMapWaypoint,
      pathItemPositions,
      sampleWithMultipleOperationalPoints,
      tMock
    );

    expect(operationalPointsWithAllWaypoints).toEqual([
      {
        id: 'West_station',
        part: {
          track: 'TA1',
          position: 500,
        },
        extensions: {
          identifier: {
            name: 'West_station',
            uic: 2,
          },
        },
        position: 0,
        weight: null,
      },
      {
        id: 'Mid_West_station',
        part: {
          track: 'TC1',
          position: 550,
        },
        extensions: {
          identifier: {
            name: 'Mid_West_station',
            uic: 3,
          },
        },
        position: 12050000,
        weight: null,
      },
      {
        id: 'Mid_East_station',
        part: {
          track: 'TD0',
          position: 14000,
        },
        extensions: {
          identifier: {
            name: 'Mid_East_station',
            uic: 4,
          },
        },
        position: 26500000,
        weight: null,
      },
    ]);
  });
});
