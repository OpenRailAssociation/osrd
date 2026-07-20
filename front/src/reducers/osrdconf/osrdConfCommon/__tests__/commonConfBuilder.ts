import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { PathStep } from 'reducers/osrdconf/types';

export default function commonConfBuilder() {
  return {
    buildPathSteps: (): PathStep[] => [
      {
        location: {
          type: 'operational_point_part_reference',
          operational_point: { uic: 474007, type: 'uic' },
        },
        id: 'brest',
        coordinates: [48.38819835024553, -4.478289762812405],
      },
      {
        location: {
          type: 'track_offset',
          track: '697841c6-6667-11e3-81ff-01f464e0362d',
          offset: 233404,
        },
        id: 'rennes',
        coordinates: [48.10326700633057, -1.6719908615098822],
        positionOnPath: 249234823,
      },
      {
        location: {
          type: 'track_offset',
          track: '60ca8dda-6667-11e3-81ff-01f464e0362d',
          offset: 416345,
        },
        id: 'lemans',
        coordinates: [47.99542250806296, 0.1918181738752042],
        positionOnPath: 411716565,
      },
      {
        location: {
          type: 'track_offset',
          track: '63c905ee-6667-11e3-81ff-01f464e0362d',
          offset: 719258,
        },
        id: 'paris',
        coordinates: [48.904852473668086, 2.4369545094357736],
        positionOnPath: 671401971,
      },
      {
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            operational_point: 'strasbourg',
            type: 'id',
          },
        },
        id: 'strasbourg',
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
      length: 1169926000,
      trackSectionRanges: [],
    }),
  };
}
