import type { TrainSchedule } from 'common/api/osrdEditoastApi';

import { readJsonFile } from '../../../utils/file-utils';

export const EXPECTED_ROW_COUNT = 5;
export const SCENARIO_NAME_PREFIX = 'times-stops-table';

export const ROW_INDEX_ORIGIN = 0;
export const ROW_INDEX_VIA_A = 2;
export const ROW_INDEX_WAYPOINT = 1;
export const ROW_INDEX_VIA_B = 3;
export const ROW_INDEX_DESTINATION = 4;

export const STOP_DURATION_VIA_A = '00h02m04s';
export const STOP_DURATION_VIA_B = '00h10m00s';
export const STOP_DURATION_NONE = '00h00m00s';

export const COMPUTED_THEORETICAL_MARGIN_DEPARTURE = '00m19s';
export const REAL_MARGIN_DEPARTURE = '158m07s';

export const POWER_RESTRICTION_C1 = 'C1';

export const myTrain: TrainSchedule[] = readJsonFile(
  './tests/assets/operation-studies/simulation-result/train.json'
);

export const STATUS_CLASSES = {
  NONE: '',
  WARNING_MARGIN: 'warning-margin',
  WARNING_SCHEDULE: 'warning-schedule',
  SUCCESS_SCHEDULE: 'success-schedule',
} as const;

export const EXPECTED_COLUMN_COUNT = 18;

export const REQUESTED_MARGIN_DEPARTURE = '2%';

export const ROW_INDEX_DISPLAY_ORDER: ReadonlyArray<[number, string]> = [
  [ROW_INDEX_ORIGIN, '1'],
  [ROW_INDEX_WAYPOINT, '2'],
  [ROW_INDEX_VIA_A, '3'],
  [ROW_INDEX_VIA_B, '4'],
  [ROW_INDEX_DESTINATION, '5'],
];
