import type {
  BoundariesData,
  ElectricalBoundariesData,
  ElectricalProfileValue,
  ElectricalRangesData,
  ElectrificationRange,
  ElectrificationValue,
  PositionData,
} from 'applications/operationalStudies/types';
import type {
  PathProperties,
  SimulationSummaryResult,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';

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

export const electrificationRanges: ElectrificationRange[] = [
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

export const electrificationRangesLarge: ElectrificationRange[] = [
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

export const trainScheduleTooFast: TrainScheduleResult = {
  id: 98,
  timetable_id: 10,
  train_name: 'tooFast',
  labels: [],
  rolling_stock_name: 'TC64700',
  start_time: '2024-08-02T12:00:00Z',
  path: [
    {
      id: 'id440',
      deleted: false,
      track: 'TA0',
      offset: 1299000,
    },
    {
      id: 'id935',
      deleted: false,
      uic: 4,
      secondary_code: 'BV',
    },
    {
      id: 'id916',
      deleted: false,
      track: 'TH1',
      offset: 4095000,
    },
  ],
  schedule: [
    {
      at: 'id935',
      arrival: 'PT1740S',
      stop_for: 'P0D',
      on_stop_signal: false,
      locked: false,
    },
    {
      at: 'id916',
      arrival: null,
      stop_for: 'P0D',
      on_stop_signal: false,
      locked: false,
    },
  ],
  margins: {
    boundaries: ['id916'],
    values: ['27%', '0%'],
  },
  initial_speed: 0,
  comfort: 'STANDARD',
  constraint_distribution: 'MARECO',
  speed_limit_tag: null,
  power_restrictions: [],
  options: {
    use_electrical_profiles: true,
  },
};

export const trainSummaryTooFast: Extract<SimulationSummaryResult, { status: 'success' }> = {
  status: 'success',
  length: 44796000,
  time: 3069187,
  energy_consumption: 144436155.68742153,
  path_item_times_final: [0, 1739394, 3069187],
  path_item_times_provisional: [0, 1834414, 3164206],
  path_item_times_base: [0, 1444453, 2491479],
};

export const trainScheduleNotHonored: TrainScheduleResult = {
  id: 96,
  timetable_id: 10,
  train_name: 'notHonored',
  labels: [],
  rolling_stock_name: 'TC64700',
  start_time: '2024-08-02T12:00:00Z',
  path: [
    {
      id: 'id440',
      deleted: false,
      track: 'TA0',
      offset: 1299000,
    },
    {
      id: 'id584',
      deleted: false,
      uic: 4,
      secondary_code: 'BV',
    },
    {
      id: 'id450',
      deleted: false,
      track: 'TG1',
      offset: 644000,
    },
  ],
  schedule: [
    {
      at: 'id584',
      arrival: 'PT300S',
      stop_for: null,
      on_stop_signal: false,
      locked: false,
    },
    {
      at: 'id450',
      arrival: null,
      stop_for: 'P0D',
      on_stop_signal: false,
      locked: false,
    },
  ],
  margins: {
    boundaries: [],
    values: ['0%'],
  },
  initial_speed: 0,
  comfort: 'STANDARD',
  constraint_distribution: 'MARECO',
  speed_limit_tag: null,
  power_restrictions: [],
  options: {
    use_electrical_profiles: true,
  },
};

export const trainSummaryNotHonored: Extract<SimulationSummaryResult, { status: 'success' }> = {
  status: 'success',
  length: 40345000,
  time: 2186885,
  energy_consumption: 173566209.50249535,
  path_item_times_final: [0, 1425534, 2186885],
  path_item_times_provisional: [0, 1425534, 2186885],
  path_item_times_base: [0, 1425534, 2186885],
};

export const trainScheduleHonored: TrainScheduleResult = {
  id: 95,
  timetable_id: 10,
  train_name: 'normal',
  labels: [],
  rolling_stock_name: 'TC64700',
  start_time: '2024-08-02T12:00:00Z',
  path: [
    {
      id: 'id440',
      deleted: false,
      track: 'TA0',
      offset: 1299000,
    },
    {
      id: 'id450',
      deleted: false,
      track: 'TG1',
      offset: 644000,
    },
  ],
  schedule: [
    {
      at: 'id450',
      arrival: null,
      stop_for: 'P0D',
      on_stop_signal: false,
      locked: false,
    },
  ],
  margins: {
    boundaries: [],
    values: ['0%'],
  },
  initial_speed: 0,
  comfort: 'STANDARD',
  constraint_distribution: 'MARECO',
  speed_limit_tag: null,
  power_restrictions: [],
  options: {
    use_electrical_profiles: true,
  },
};

export const trainScheduleNoSchedule: TrainScheduleResult = {
  ...trainScheduleHonored,
  schedule: undefined,
};

export const trainScheduleNoMatch: TrainScheduleResult = {
  ...trainScheduleHonored,
  schedule: [
    {
      at: 'notExisting',
      arrival: 'PT300S',
      stop_for: 'P0D',
      on_stop_signal: false,
      locked: false,
    },
  ],
};

export const trainSummaryHonored: Extract<SimulationSummaryResult, { status: 'success' }> = {
  status: 'success',
  length: 40345000,
  time: 2186885,
  energy_consumption: 173566210.50249535,
  path_item_times_final: [0, 2186885],
  path_item_times_provisional: [0, 2186885],
  path_item_times_base: [0, 2186885],
};

// Data for upsertMapWaypointsInOperationalPoints

export const pathInputsWithOneMapWaypoint: TrainScheduleResult['path'] = [
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

export const pathInputsWithNoMapWaypoint: TrainScheduleResult['path'] = [
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

export const sampleWithMultipleOperationalPoints: NonNullable<
  PathProperties['operational_points']
> = [
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
  },
];

export const pathInputWithWaypointsByMapOnly: TrainScheduleResult['path'] = [
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

export const pathInputsEndingWithTwoWaypointsByMap: TrainScheduleResult['path'] = [
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

export const sampleWithOneOperationalPoint: NonNullable<PathProperties['operational_points']> = [
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
  },
];
