import type { TFunction } from 'i18next';
import { describe, it, expect } from 'vitest';

import type { PathItem } from 'common/api/osrdEditoastApi';
import type { PathWaypoint } from 'modules/simulationResult/types';

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

const getOperationalPoints = (inputs: Op[]): PathWaypoint[] =>
  inputs.map((op) => ({
    waypointId: op.name,
    opId: null,
    pathItemId: null,
    name: op.name,
    uic: op.uic,
    country_code: '??',
    is_passenger_station: true,
    main_code: '',
    part: {
      track: op.track,
      position: op.positionOnTrack,
      local_track_name: 'V1',
    },
    position: op.positionOnPath,
    weight: null,
    location: {
      type: 'operational_point_part_reference',
      operational_point: {
        type: 'uic',
        uic: op.uic,
      },
    },
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
    const pathSteps: PathItem[] = [
      {
        id: '1',
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            uic: 2,
            secondary_code: 'BV',
            type: 'uic',
          },
        },
      },
      {
        id: '2',
        location: {
          type: 'track_offset',
          track: 'TA6',
          offset: 7746000,
        },
      },
      {
        id: '3',
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            uic: 4,
            secondary_code: 'BV',
            type: 'uic',
          },
        },
      },
    ];
    const pathItemPositions = [0, 9246000, 26500000];

    const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
      'path',
      pathSteps,
      pathItemPositions,
      OPERATIONAL_POINTS,
      tMock
    );

    const expectedOps: PathWaypoint[] = [
      {
        opId: null,
        waypointId: 'West_station',
        pathItemId: null,
        name: 'West_station',
        uic: 2,
        country_code: '??',
        is_passenger_station: true,
        main_code: '',
        part: {
          track: 'TA1',
          position: 500,
          local_track_name: 'V1',
        },
        position: 0,
        weight: null,
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            type: 'uic',
            uic: 2,
          },
        },
      },
      {
        opId: null,
        waypointId: 'pathitem-2',
        pathItemId: '2',
        name: 't_requestedPoint',
        uic: 0,
        country_code: '??',
        is_passenger_station: false,
        main_code: '',
        part: {
          track: 'TA6',
          position: 7746000,
          local_track_name: 'V1',
        },
        position: 9246000,
        weight: 100,
        location: {
          type: 'track_offset',
          track: 'TA6',
          offset: 7746000,
        },
      },
      {
        opId: null,
        waypointId: 'Mid_West_station',
        pathItemId: null,
        name: 'Mid_West_station',
        uic: 3,
        country_code: '??',
        is_passenger_station: true,
        main_code: '',
        part: {
          track: 'TC1',
          position: 550,
          local_track_name: 'V1',
        },
        position: 12050000,
        weight: null,
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            type: 'uic',
            uic: 3,
          },
        },
      },
      {
        opId: null,
        waypointId: 'Mid_East_station',
        pathItemId: null,
        name: 'Mid_East_station',
        uic: 4,
        country_code: '??',
        is_passenger_station: true,
        main_code: '',
        part: {
          track: 'TD0',
          position: 14000,
          local_track_name: 'V1',
        },
        position: 26500000,
        weight: null,
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            type: 'uic',
            uic: 4,
          },
        },
      },
    ];

    expect(operationalPointsWithAllWaypoints).toEqual(expectedOps);
  });

  it('should add waypoints properly even when the last two come from map clicks', () => {
    const pathSteps: PathItem[] = [
      {
        id: '1',
        location: {
          type: 'track_offset',
          track: 'TA6',
          offset: 6481000,
        },
      },
      {
        id: '2',
        location: {
          type: 'track_offset',
          track: 'TC0',
          offset: 679000,
        },
      },
      {
        id: '3',
        location: {
          type: 'track_offset',
          track: 'TC0',
          offset: 883000,
        },
      },
    ];
    const pathItemPositions = [0, 4198000, 4402000];

    const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
      'path',
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

    const expectedOps: PathWaypoint[] = [
      {
        opId: null,
        waypointId: 'pathitem-1',
        pathItemId: '1',
        name: 't_requestedOrigin',
        uic: 0,
        country_code: '??',
        is_passenger_station: false,
        main_code: '',
        part: {
          track: 'TA6',
          position: 6481000,
          local_track_name: 'V1',
        },
        position: 0,
        weight: 100,
        location: {
          type: 'track_offset',
          track: 'TA6',
          offset: 6481000,
        },
      },
      {
        opId: null,
        waypointId: 'Mid_West_station',
        pathItemId: null,
        name: 'Mid_West_station',
        uic: 3,
        country_code: '??',
        is_passenger_station: true,
        main_code: '',
        part: {
          track: 'TC0',
          position: 550,
          local_track_name: 'V1',
        },
        position: 4069000,
        weight: null,
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            type: 'uic',
            uic: 3,
          },
        },
      },
      {
        opId: null,
        waypointId: 'pathitem-2',
        pathItemId: '2',
        name: 't_requestedPoint',
        uic: 0,
        country_code: '??',
        is_passenger_station: false,
        main_code: '',
        part: {
          track: 'TC0',
          position: 679000,
          local_track_name: 'V1',
        },
        position: 4198000,
        weight: 100,
        location: {
          type: 'track_offset',
          track: 'TC0',
          offset: 679000,
        },
      },
      {
        opId: null,
        waypointId: 'pathitem-3',
        pathItemId: '3',
        name: 't_requestedDestination',
        uic: 0,
        country_code: '??',
        is_passenger_station: false,
        main_code: '',
        part: {
          track: 'TC0',
          position: 883000,
          local_track_name: 'V1',
        },
        position: 4402000,
        weight: 100,
        location: {
          type: 'track_offset',
          track: 'TC0',
          offset: 883000,
        },
      },
    ];

    expect(operationalPointsWithAllWaypoints).toEqual(expectedOps);
  });

  it('should add waypoints properly when there is no op on path', () => {
    const pathSteps: PathItem[] = [
      {
        id: '1',
        location: {
          type: 'track_offset',
          track: 'TA6',
          offset: 6481000,
        },
      },
      {
        id: '2',
        location: {
          type: 'track_offset',
          track: 'TA6',
          offset: 4733000,
        },
      },
    ];
    const pathItemPositions = [0, 1748000];

    const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
      'path',
      pathSteps,
      pathItemPositions,
      [],
      tMock
    );

    const expectedOps: PathWaypoint[] = [
      {
        opId: null,
        waypointId: 'pathitem-1',
        pathItemId: '1',
        name: 't_requestedOrigin',
        uic: 0,
        country_code: '??',
        is_passenger_station: false,
        main_code: '',
        part: {
          track: 'TA6',
          position: 6481000,
          local_track_name: 'V1',
        },
        position: 0,
        weight: 100,
        location: {
          type: 'track_offset',
          track: 'TA6',
          offset: 6481000,
        },
      },
      {
        opId: null,
        waypointId: 'pathitem-2',
        pathItemId: '2',
        name: 't_requestedDestination',
        uic: 0,
        country_code: '??',
        is_passenger_station: false,
        main_code: '',
        part: {
          track: 'TA6',
          position: 4733000,
          local_track_name: 'V1',
        },
        position: 1748000,
        weight: 100,
        location: {
          type: 'track_offset',
          track: 'TA6',
          offset: 4733000,
        },
      },
    ];

    expect(operationalPointsWithAllWaypoints).toEqual(expectedOps);
  });

  it('should return the same array if there is no waypoints added by map click', () => {
    const pathSteps: PathItem[] = [
      {
        id: '1',
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            uic: 2,
            secondary_code: 'BV',
            type: 'uic',
          },
        },
      },
      {
        id: '2',
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            uic: 3,
            secondary_code: 'BV',
            type: 'uic',
          },
        },
      },
      {
        id: '3',
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            uic: 4,
            secondary_code: 'BV',
            type: 'uic',
          },
        },
      },
    ];
    const pathItemPositions = [0, 12050000, 26500000];

    const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
      'path',
      pathSteps,
      pathItemPositions,
      OPERATIONAL_POINTS,
      tMock
    );

    const expectedOps: PathWaypoint[] = [
      {
        opId: null,
        waypointId: 'West_station',
        pathItemId: null,
        name: 'West_station',
        uic: 2,
        country_code: '??',
        is_passenger_station: true,
        main_code: '',
        part: {
          track: 'TA1',
          position: 500,
          local_track_name: 'V1',
        },
        position: 0,
        weight: null,
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            type: 'uic',
            uic: 2,
          },
        },
      },
      {
        opId: null,
        waypointId: 'Mid_West_station',
        pathItemId: null,
        name: 'Mid_West_station',
        uic: 3,
        country_code: '??',
        is_passenger_station: true,
        main_code: '',
        part: {
          track: 'TC1',
          position: 550,
          local_track_name: 'V1',
        },
        position: 12050000,
        weight: null,
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            type: 'uic',
            uic: 3,
          },
        },
      },
      {
        opId: null,
        waypointId: 'Mid_East_station',
        pathItemId: null,
        name: 'Mid_East_station',
        uic: 4,
        country_code: '??',
        is_passenger_station: true,
        main_code: '',
        part: {
          track: 'TD0',
          position: 14000,
          local_track_name: 'V1',
        },
        position: 26500000,
        weight: null,
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            type: 'uic',
            uic: 4,
          },
        },
      },
    ];

    expect(operationalPointsWithAllWaypoints).toEqual(expectedOps);
  });
});
