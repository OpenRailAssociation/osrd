import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';

export default function commonConfBuilder() {
  return {
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
