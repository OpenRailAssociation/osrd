import type { TFunction } from 'i18next';
import { describe, it, expect } from 'vitest';

import type { PathProperties } from 'common/api/osrdEditoastApi';

import { upsertMapWaypointsInOperationalPoints } from '../helpers/upsertMapWaypointsInOperationalPoints';

/**
Mocks the translation t function by stripping the namespace prefixes of the passed translation key and prefixing it with t_
Example: tMock('main.requestedPoint') => 't_requestedPoint'
*/
const tMock = ((key: string, _options?: unknown) => `t_${key.split('.').at(-1)}`) as TFunction;

type Op = {
  name: string;
  uic: number;
  track: string;
  positionOnTrack: number;
  positionOnPath: number;
};

const getOperationalPoints = (inputs: Op[]): NonNullable<PathProperties['operational_points']> =>
  inputs.map((op) => ({
    id: op.name,
    part: {
      track: op.track,
      position: op.positionOnTrack,
    },
    extensions: {
      identifier: {
        name: op.name,
        uic: op.uic,
      },
    },
    position: op.positionOnPath,
    weight: null,
  }));

const OPERATIONAL_POINTS = getOperationalPoints([
  {
    name: 'West_station',
    uic: 2,
    track: 'TA1',
    positionOnTrack: 500,
    positionOnPath: 0,
  },
  {
    name: 'Mid_West_station',
    uic: 3,
    track: 'TC1',
    positionOnTrack: 550,
    positionOnPath: 12050000,
  },
  {
    name: 'Mid_East_station',
    uic: 4,
    track: 'TD0',
    positionOnTrack: 14000,
    positionOnPath: 26500000,
  },
]);

describe('upsertMapWaypointsInOperationalPoints', () => {
  it('should add waypoints at the good position in a path with operational points', () => {
    const pathSteps = [
      {
        id: '1',
        secondary_code: 'BV',
        uic: 2,
      },
      {
        id: '2',
        offset: 7746000,
        track: 'TA6',
      },
      {
        id: '3',
        secondary_code: 'BV',
        uic: 4,
      },
    ];
    const pathItemPositions = [0, 9246000, 26500000];

    const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
      'EditoastPathOperationalPoint',
      pathSteps,
      pathItemPositions,
      OPERATIONAL_POINTS,
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
            name: 't_requestedPoint',
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
    const pathSteps = [
      {
        id: '1',
        offset: 6481000,
        track: 'TA6',
      },
      {
        id: '2',
        offset: 679000,
        track: 'TC0',
      },
      {
        id: '3',
        offset: 883000,
        track: 'TC0',
      },
    ];
    const pathItemPositions = [0, 4198000, 4402000];

    const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
      'EditoastPathOperationalPoint',
      pathSteps,
      pathItemPositions,
      getOperationalPoints([
        {
          name: 'Mid_West_station',
          uic: 3,
          track: 'TC0',
          positionOnTrack: 550,
          positionOnPath: 4069000,
        },
      ]),
      tMock
    );

    expect(operationalPointsWithAllWaypoints).toEqual([
      {
        id: '1',
        extensions: {
          identifier: {
            name: 't_requestedOrigin',
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
            name: 't_requestedPoint',
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
            name: 't_requestedDestination',
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
    const pathSteps = [
      {
        id: '1',
        offset: 6481000,
        track: 'TA6',
      },
      {
        id: '2',
        offset: 4733000,
        track: 'TA6',
      },
    ];
    const pathItemPositions = [0, 1748000];

    const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
      'EditoastPathOperationalPoint',
      pathSteps,
      pathItemPositions,
      [],
      tMock
    );

    expect(operationalPointsWithAllWaypoints).toEqual([
      {
        id: '1',
        extensions: {
          identifier: {
            name: 't_requestedOrigin',
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
            name: 't_requestedDestination',
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
    const pathSteps = [
      {
        id: '1',
        secondary_code: 'BV',
        uic: 2,
      },
      {
        id: '2',
        secondary_code: 'BV',
        uic: 3,
      },
      {
        id: '3',
        secondary_code: 'BV',
        uic: 4,
      },
    ];
    const pathItemPositions = [0, 12050000, 26500000];

    const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
      'EditoastPathOperationalPoint',
      pathSteps,
      pathItemPositions,
      OPERATIONAL_POINTS,
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
