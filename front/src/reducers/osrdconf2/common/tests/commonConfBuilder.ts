import {
  OsrdConfState,
  PointOnMap,
  PowerRestrictionRange,
} from 'applications/operationalStudies/consts';
import { Allowance, Path } from 'common/api/osrdEditoastApi';
import { Feature } from 'geojson';
import { SwitchType } from 'types';

export default function commonConfBuilder() {
  return {
    buildEngineeringAllowance: (): Allowance => ({
      allowance_type: 'engineering',
      capacity_speed_limit: 5,
      distribution: 'MARECO',
      begin_position: 2,
      end_position: 4,
      value: {
        value_type: 'time_per_distance',
        minutes: 3,
      },
    }),
    buildStandardAllowance: (): Allowance => ({
      allowance_type: 'standard',
      capacity_speed_limit: 5,
      distribution: 'LINEAR',
      ranges: [
        {
          begin_position: 1,
          end_position: 2,
          value: {
            value_type: 'time',
            seconds: 10,
          },
        },
      ],
      default_value: {
        value_type: 'time_per_distance',
        minutes: 3,
      },
    }),
    buildSwitchType: (): SwitchType => ({
      id: 'point_switch',
      ports: ['A', 'B1', 'B2'],
      groups: {
        A_B1: [
          {
            src: 'A',
            dst: 'B1',
          },
        ],
        A_B2: [
          {
            src: 'A',
            dst: 'B2',
          },
        ],
      },
    }),
    buildPointOnMap: (fields?: Partial<PointOnMap>): PointOnMap => ({
      id: 'test',
      name: 'point',
      ...fields,
    }),
    buildGeoJson: (): Path => ({
      created: '10/10/2023',
      curves: [{ position: 10, radius: 2 }],
      geographic: {
        coordinates: [
          [1, 2],
          [3, 4],
        ],
        type: 'type-test',
      },
      id: 1,
      length: 10,
      owner: 'test',
      schematic: {
        coordinates: [
          [1, 2],
          [3, 4],
        ],
        type: 'type-test',
      },
      slopes: [
        {
          gradient: 5,
          position: 2,
        },
      ],
      steps: [
        {
          duration: 2,
          geo: {
            coordinates: [1, 2],
            type: 'type-test',
          },
          id: 'toto',
          location: {
            offset: 12,
            track_section: 'iti',
          },
          name: 'test',
          path_offset: 42,
          sch: {
            coordinates: [1, 2],
            type: 'type-test',
          },
          suggestion: true,
        },
      ],
    }),
    buildFeatureInfoClick: (
      featureInfoClickFields?: Partial<OsrdConfState['featureInfoClick']>
    ): OsrdConfState['featureInfoClick'] => ({
      displayPopup: true,
      feature: {
        type: 'Feature',
        _geometry: {
          type: 'LineString',
          coordinates: [12, 45],
        },
        properties: {
          title: 'test',
          toto: 'toto',
        },
        id: 'test',
        _vectorTileFeature: {
          id: 10,
          type: 1,
          extent: 15,
          properties: {
            name: 'test',
          },
        },
      } as unknown as Feature,
      ...featureInfoClickFields,
    }),
    buildPowerRestrictionRanges: (): PowerRestrictionRange[] => [
      {
        value: 'test',
        begin: 1,
        end: 2,
      },
    ],
  };
}
