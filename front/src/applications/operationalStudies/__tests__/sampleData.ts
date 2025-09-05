import type {
  BoundariesData,
  ElectricalBoundariesData,
  ElectricalProfileValue,
  ElectricalRangesData,
  ElectrificationRange,
  ElectrificationValue,
  PositionData,
} from 'applications/operationalStudies/types';
import type { SimulationSummaryResult } from 'common/api/osrdEditoastApi';
import type { TrainScheduleId, TrainScheduleWithTrainId } from 'reducers/osrdconf/types';

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

export const trainScheduleTooFast: TrainScheduleWithTrainId = {
  id: 'trainschedule-98' as TrainScheduleId,
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
      reception_signal: 'OPEN',
      locked: false,
    },
    {
      at: 'id916',
      arrival: null,
      stop_for: 'P0D',
      reception_signal: 'OPEN',
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
  path_item_positions: [0, 1000, 2000],
};

export const trainScheduleTooFastOnInterval: TrainScheduleWithTrainId = {
  id: 'trainschedule_38366' as TrainScheduleId,
  train_name: 'tooFastOnInterval',
  labels: [],
  rolling_stock_name: 'rs-fictive',
  start_time: '2026-12-13T07:25:00Z',
  path: [
    {
      id: 'idA',
      deleted: false,
      uic: 87700000,
      secondary_code: 'BV',
      track_reference: null,
    },
    {
      id: 'idB',
      deleted: false,
      uic: 87700001,
      secondary_code: 'BV',
      track_reference: null,
    },
    {
      id: 'idC',
      deleted: false,
      uic: 87700002,
      secondary_code: 'BV',
      track_reference: null,
    },
  ],
  schedule: [
    {
      at: 'idB',
      arrival: 'PT5280S',
      stop_for: null,
      reception_signal: 'OPEN',
      locked: false,
    },
    {
      at: 'idC',
      arrival: 'PT15300S',
      stop_for: 'P0D',
      reception_signal: 'OPEN',
      locked: false,
    },
  ],
  margins: {
    boundaries: ['idC'],
    values: ['6.5min/100km', '0%'],
  },
  initial_speed: 0,
  comfort: 'STANDARD',
  constraint_distribution: 'STANDARD',
  speed_limit_tag: null,
  power_restrictions: [],
  options: {
    use_electrical_profiles: true,
    use_speed_limits_for_simulation: true,
  },
  category: null,
};

export const trainSummaryTooFastOnInterval: Extract<
  SimulationSummaryResult,
  { status: 'success' }
> = {
  status: 'success',
  length: 544740000,
  time: 15300915,
  energy_consumption: 12116583709.633162,
  path_item_times_final: [0, 5280030, 15300915],
  path_item_times_provisional: [0, 5222392, 15267584],
  path_item_times_base: [0, 4730243, 13828795],
  path_item_positions: [0, 1000, 2000],
};

export const trainScheduleNotHonored: TrainScheduleWithTrainId = {
  id: 'trainschedule-96' as TrainScheduleId,
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
      reception_signal: 'OPEN',
      locked: false,
    },
    {
      at: 'id450',
      arrival: null,
      stop_for: 'P0D',
      reception_signal: 'OPEN',
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
  path_item_positions: [0, 1000, 2000],
};

export const trainScheduleHonored: TrainScheduleWithTrainId = {
  id: 'trainschedule-95' as TrainScheduleId,
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
      reception_signal: 'OPEN',
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

export const trainScheduleNoSchedule: TrainScheduleWithTrainId = {
  ...trainScheduleHonored,
  schedule: undefined,
};

export const trainScheduleNoMatch: TrainScheduleWithTrainId = {
  ...trainScheduleHonored,
  schedule: [
    {
      at: 'notExisting',
      arrival: 'PT300S',
      stop_for: 'P0D',
      reception_signal: 'OPEN',
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
  path_item_positions: [0, 1000],
};
