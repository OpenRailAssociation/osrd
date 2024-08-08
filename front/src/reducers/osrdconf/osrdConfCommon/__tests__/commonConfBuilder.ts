import type { Feature } from 'geojson';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { OsrdConfState, PathStep } from 'reducers/osrdconf/types';

export default function commonConfBuilder() {
  return {
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
      manchetteOperationalPoints: [],
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
