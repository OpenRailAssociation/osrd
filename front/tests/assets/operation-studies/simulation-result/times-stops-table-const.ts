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
export const REQUESTED_ARRIVAL_VIA_B = '00:03:54';
export const REQUESTED_DEPARTURE_VIA_B = '00:13:54';

export const EMPTY_TIME_PLACEHOLDER = 'hh:mm:ss';
export const EDIT_ARRIVAL_VIA_A = '21:30:00';
export const EDIT_DEPARTURE_VIA_B = '00:15:00';
export const COMPUTED_THEORETICAL_MARGIN_DEPARTURE = '00m19s';
export const REAL_MARGIN_DEPARTURE = '158m07s';

export const STOP_DURATION_EDIT_DIGITS = '0500';
export const STOP_DURATION_EDIT_DISPLAY = '00h05m00s';
export const MARGIN_EDIT_VALUE = '5';
export const MARGIN_EDIT_DISPLAY = '5%';
export const NO_POWER_RESTRICTION_VALUE = 'NO_POWER_RESTRICTION';
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

export const EXPECTED_COLUMN_COUNT = 19;
export const MARGIN_MIN_PER_100KM_VALUE = '3';
export const MARGIN_MIN_PER_100KM_DISPLAY = '3min/100km';
export const MARGIN_UNIT_MIN_PER_100KM = 'minPer100km';
export const REQUESTED_MARGIN_DEPARTURE = '2%';

export const ROW_INDEX_DISPLAY_ORDER: ReadonlyArray<[number, string]> = [
  [ROW_INDEX_ORIGIN, '1'],
  [ROW_INDEX_WAYPOINT, '2'],
  [ROW_INDEX_VIA_A, '3'],
  [ROW_INDEX_VIA_B, '4'],
  [ROW_INDEX_DESTINATION, '5'],
];
