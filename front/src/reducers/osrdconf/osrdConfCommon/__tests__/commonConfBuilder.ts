import type { Feature } from 'geojson';

import type { SwitchType } from 'applications/editor/tools/switchEdition/types';
import type { PointOnMap, PowerRestrictionRange } from 'applications/operationalStudies/consts';
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { Allowance, PathResponse, RangedValue } from 'common/api/osrdEditoastApi';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';
import type { OsrdConfState, PathStep } from 'reducers/osrdconf/types';

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
    buildGeoJson: (): PathResponse => ({
      created: '10/10/2023',
      curves: [{ position: 10, radius: 2 }],
      geographic: {
        coordinates: [
          [1, 2],
          [3, 4],
        ],
        type: 'LineString',
      },
      id: 1,
      length: 10,
      owner: 'test',
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
            type: 'Point',
          },
          id: 'toto',
          location: {
            offset: 12,
            track_section: 'iti',
          },
          name: 'test',
          path_offset: 42,
          suggestion: true,
          ch: null,
          uic: null,
        },
      ],
    }),

    buildPowerRestrictionRanges: (): PowerRestrictionRange[] => [
      {
        value: 'test',
        begin: 1,
        end: 2,
      },
    ],

    buildFormattedPathElectrificationRanges: (): RangedValue[] => [
      { begin: 0, end: 10, value: '1500V' },
      { begin: 10, end: 20, value: '25000V' },
      { begin: 20, end: 25, value: '1500V' },
    ],

    buildFormattedPowerRestrictionRanges: (): PowerRestrictionRange[] => [
      { begin: 0, end: 10, value: NO_POWER_RESTRICTION },
      { begin: 10, end: 12, value: 'C1US' },
      { begin: 12, end: 22, value: 'C2US' },
      { begin: 22, end: 25, value: NO_POWER_RESTRICTION },
    ],

    buildExpectedIntervals: (): PowerRestrictionRange[] => [
      { begin: 0, end: 10, value: NO_POWER_RESTRICTION },
      { begin: 10, end: 12, value: 'C1US' },
      { begin: 12, end: 20, value: 'C2US' },
      { begin: 20, end: 22, value: 'C2US' },
      { begin: 22, end: 25, value: NO_POWER_RESTRICTION },
    ],

    buildIntervals: (): PowerRestrictionRange[] => [
      { begin: 0, end: 10, value: NO_POWER_RESTRICTION },
      { begin: 10, end: 12, value: NO_POWER_RESTRICTION },
      { begin: 12, end: 17, value: NO_POWER_RESTRICTION },
      { begin: 17, end: 20, value: NO_POWER_RESTRICTION },
      { begin: 20, end: 25, value: NO_POWER_RESTRICTION },
    ],

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

    buildPathSteps: (): PathStep[] => [
      {
        uic: 474007,
        id: 'brest',
        locked: true,
        coordinates: [48.38819835024553, -4.478289762812405],
      },
      {
        track: '697841c6-6667-11e3-81ff-01f464e0362d',
        offset: 233404,
        id: 'rennes',
        coordinates: [48.10326700633057, -1.6719908615098822],
        positionOnPath: 249234823,
      },
      {
        track: '60ca8dda-6667-11e3-81ff-01f464e0362d',
        offset: 416345,
        id: 'lemans',
        coordinates: [47.99542250806296, 0.1918181738752042],
        positionOnPath: 411716565,
      },
      {
        track: '63c905ee-6667-11e3-81ff-01f464e0362d',
        offset: 719258,
        id: 'paris',
        coordinates: [48.904852473668086, 2.4369545094357736],
        positionOnPath: 671401971,
      },
      {
        operational_point: 'strasbourg',
        id: 'strasbourg',
        locked: true,
        coordinates: [48.58505541984412, 7.73387081978364],
      },
    ],

    buildPathProperties: (): ManageTrainSchedulePathProperties => ({
      electrifications: {
        boundaries: [84015000],
        values: [
          {
            type: 'electrification',
            voltage: '25000V',
          },
        ],
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [48.38819835024553, -4.478289762812405],
          [48.10326700633057, -1.6719908615098822],
          [48.209531, 0.151248],
          [48.904852473668086, 2.4369545094357736],
          [48.58505541984412, 7.73387081978364],
        ],
      },
      suggestedOperationalPoints: [],
      allWaypoints: [],
      length: 1169926000,
      trackSectionRanges: [],
    }),
  };
}
