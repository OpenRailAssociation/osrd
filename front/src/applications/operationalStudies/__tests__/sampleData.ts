import type {
  BoundariesData,
  ElectricalBoundariesData,
  ElectricalProfileValue,
  ElectricalRangesData,
  ElectrificationRangeV2,
  ElectrificationValue,
  PositionData,
} from 'applications/operationalStudies/types';

export const pathLength = 4000;

/**
 * Data for transformBoundariesDataToPositionDataArray
 */

export const boundariesDataWithNumber: BoundariesData = {
  boundaries: [1000, 2000, 3000],
  values: [1, 2, 3, 4],
};

export const getExpectedResultDataNumber = <T extends 'gradient' | 'radius'>(
  value: T
): PositionData<T>[] =>
  [
    { position: 0, [value]: 0 },
    { position: 1, [value]: 1 },
    { position: 1, [value]: 2 },
    { position: 2, [value]: 2 },
    { position: 2, [value]: 3 },
    { position: 3, [value]: 3 },
    { position: 3, [value]: 4 },
    { position: 4, [value]: 4 },
  ] as PositionData<T>[];

/**
 * Data for transformBoundariesDataToRangesData
 */

export const boundariesDataWithElectrification: ElectricalBoundariesData<ElectrificationValue> = {
  boundaries: [1000, 2000, 3000],
  values: [
    {
      type: 'electrification',
      voltage: '1500V',
    },
    {
      lower_pantograph: true,
      type: 'neutral_section',
    },
    {
      type: 'non_electrified',
    },
    {
      type: 'electrification',
      voltage: '25000V',
    },
  ],
};

export const boundariesDataWithElectrificalProfile: ElectricalBoundariesData<ElectricalProfileValue> =
  {
    boundaries: [1000, 2000, 3000],
    values: [
      {
        electrical_profile_type: 'profile',
        profile: 'O',
        handled: true,
      },
      {
        electrical_profile_type: 'no_profile',
      },
      {
        electrical_profile_type: 'no_profile',
      },
      {
        electrical_profile_type: 'profile',
        profile: '25000V',
        handled: false,
      },
    ],
  };

/**
 * Data for formatElectrificationRanges
 */

export const electrificationRangesData: ElectricalRangesData<ElectrificationValue>[] = [
  {
    start: 0,
    stop: 1,
    values: {
      type: 'electrification',
      voltage: '1500V',
    },
  },
  {
    start: 1,
    stop: 2,
    values: {
      lower_pantograph: true,
      type: 'neutral_section',
    },
  },
  {
    start: 2,
    stop: 3,
    values: {
      type: 'non_electrified',
    },
  },
  {
    start: 3,
    stop: 4,
    values: {
      type: 'electrification',
      voltage: '25000V',
    },
  },
];

export const electrificationRangesDataLarge: ElectricalRangesData<ElectrificationValue>[] = [
  {
    start: 0,
    stop: 1,
    values: {
      type: 'electrification',
      voltage: '1500V',
    },
  },
  {
    start: 1,
    stop: 2,
    values: {
      lower_pantograph: true,
      type: 'neutral_section',
    },
  },
  {
    start: 2,
    stop: 3,
    values: {
      lower_pantograph: false,
      type: 'neutral_section',
    },
  },
  {
    start: 3,
    stop: 4,
    values: {
      type: 'non_electrified',
    },
  },
  {
    start: 4,
    stop: 5,
    values: {
      type: 'electrification',
      voltage: '25000V',
    },
  },
  {
    start: 5,
    stop: 6,
    values: {
      type: 'electrification',
      voltage: '1500V',
    },
  },
];

export const electricalProfileRangesData: ElectricalRangesData<ElectricalProfileValue>[] = [
  {
    start: 0,
    stop: 1,
    values: {
      electrical_profile_type: 'profile',
      profile: 'O',
      handled: true,
    },
  },
  {
    start: 1,
    stop: 2,
    values: {
      electrical_profile_type: 'no_profile',
    },
  },
  {
    start: 2,
    stop: 3,
    values: {
      electrical_profile_type: 'no_profile',
    },
  },
  {
    start: 3,
    stop: 4,
    values: {
      electrical_profile_type: 'profile',
      profile: '25000V',
      handled: false,
    },
  },
];

export const electricalProfileRangesDataShort: ElectricalRangesData<ElectricalProfileValue>[] = [
  {
    start: 0,
    stop: 1,
    values: {
      electrical_profile_type: 'profile',
      profile: 'O',
      handled: true,
    },
  },
  {
    start: 1,
    stop: 4,
    values: {
      electrical_profile_type: 'no_profile',
    },
  },
  {
    start: 4,
    stop: 5,
    values: {
      electrical_profile_type: 'profile',
      profile: '25000V',
      handled: false,
    },
  },
  {
    start: 5,
    stop: 6,
    values: {
      electrical_profile_type: 'profile',
      profile: 'A1',
      handled: true,
    },
  },
];

export const electrificationRanges: ElectrificationRangeV2[] = [
  {
    start: 0,
    stop: 1,
    electrificationUsage: {
      type: 'electrification',
      voltage: '1500V',
      electrical_profile_type: 'profile',
      profile: 'O',
      handled: true,
    },
  },
  {
    start: 1,
    stop: 2,
    electrificationUsage: {
      lower_pantograph: true,
      type: 'neutral_section',
      electrical_profile_type: 'no_profile',
    },
  },
  {
    start: 2,
    stop: 3,
    electrificationUsage: {
      type: 'non_electrified',
      electrical_profile_type: 'no_profile',
    },
  },
  {
    start: 3,
    stop: 4,
    electrificationUsage: {
      type: 'electrification',
      voltage: '25000V',
      electrical_profile_type: 'profile',
      profile: '25000V',
      handled: false,
    },
  },
];

export const electrificationRangesLarge: ElectrificationRangeV2[] = [
  {
    start: 0,
    stop: 1,
    electrificationUsage: {
      type: 'electrification',
      voltage: '1500V',
      electrical_profile_type: 'profile',
      profile: 'O',
      handled: true,
    },
  },
  {
    start: 1,
    stop: 2,
    electrificationUsage: {
      lower_pantograph: true,
      type: 'neutral_section',
      electrical_profile_type: 'no_profile',
    },
  },
  {
    start: 2,
    stop: 3,
    electrificationUsage: {
      lower_pantograph: false,
      type: 'neutral_section',
      electrical_profile_type: 'no_profile',
    },
  },
  {
    start: 3,
    stop: 4,
    electrificationUsage: {
      type: 'non_electrified',
      electrical_profile_type: 'no_profile',
    },
  },
  {
    start: 4,
    stop: 5,
    electrificationUsage: {
      type: 'electrification',
      voltage: '25000V',
      electrical_profile_type: 'profile',
      profile: '25000V',
      handled: false,
    },
  },
  {
    start: 5,
    stop: 6,
    electrificationUsage: {
      type: 'electrification',
      voltage: '1500V',
      electrical_profile_type: 'profile',
      profile: 'A1',
      handled: true,
    },
  },
];
