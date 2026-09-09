import type { OccurrenceDetails, OccurrenceMenuButton } from '../../utils/types';
import {
  IMPORT_PACED_TRAIN_OCCURRENCES_DETAILS,
  IMPORTED_PACED_TRAIN_DETAILS,
} from '../constants/operational-studies-const';
import {
  dualModeRollingStockName,
  fastRollingStockName,
  slowRollingStockName,
} from '../constants/project-const';

export const EDITED_OCCURRENCE_NAME = 'Paced train occurrence edited';

export const INITIAL_OCCURRENCE_NAME = '8608';

export const CONFORM_ACTIVE_OCCURRENCE_MENU_BUTTONS: OccurrenceMenuButton[] = [
  'disable',
  'edit',
  'project',
];

export const EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS: OccurrenceMenuButton[] = [
  'disable',
  'edit',
  'project',
  'restore',
];

export const ADDED_EXCEPTION_MENU_BUTTONS: OccurrenceMenuButton[] = ['edit', 'project', 'delete'];
export const ADDED_AND_MODIFIED_EXCEPTION_MENU_BUTTONS: OccurrenceMenuButton[] = [
  'edit',
  'project',
  'delete',
  'restore',
];

export const DISABLED_OCCURRENCE_MENU_BUTTONS: OccurrenceMenuButton[] = ['enable'];

export const TIME_WINDOW = '240';
export const TIME_WINDOW_HOURS = '04';
export const TIME_WINDOW_MINUTES = '00';
export const INTERVAL = '20';
export const EDITED_PACED_TRAIN_NAME = 'Paced train edited';
export const PACED_TRAIN_OCCURRENCE_COUNT = 2;

export const DEFAULT_PACED_TRAIN_NAME = 'Default paced train';
// E2E scenarios use calendar timetables, where a new service spans a full day
export const DEFAULT_PACED_TRAIN_SERVICE_WINDOW_HOURS = '24';
export const DEFAULT_PACED_TRAIN_SERVICE_WINDOW_MINUTES = '00';
export const DEFAULT_PACED_TRAIN_ROW_COUNT = 2;
export const DEFAULT_MIDNIGHT_HOUR = '00:00:00';

export const NEW_PACED_TRAIN_ROUTE_SEARCH = 'WS MWS MES NES';
export const NEW_PACED_TRAIN_DEPARTURE_DATE = '15/03/25';
export const NEW_PACED_TRAIN_SERVICE_WINDOW_HOURS = '1';
export const NEW_PACED_TRAIN_SERVICE_WINDOW_MINUTES = '30';

export const WEST_STATION_REQUESTED_ARRIVAL = '08:35:40';
export const WEST_STATION_MARGIN_VALUE = '5';
export const WEST_STATION_MARGIN_UNIT = 'percent';

export const MID_WEST_STATION_MARGIN_VALUE = '1';
export const MID_WEST_STATION_MARGIN_UNIT = 'minPer100km';
export const MID_WEST_STATION_REQUESTED_ARRIVAL = '11:47:40';
export const MID_WEST_STATION_STOP_DURATION_DIGITS = '0500';
export const MID_EAST_STATION_REQUESTED_ARRIVAL = '12:05:21';
export const MID_EAST_STATION_STOP_DURATION_DIGITS = '0204';

export const EDITED_EXCEPTION_TRAIN_NAME = IMPORTED_PACED_TRAIN_DETAILS[5].name;
export const EDITED_EXCEPTION_NEW_REQUESTED_ARRIVAL = '12:00:00';

// Occurrences are listed by start time. Setting the origin arrival to 12:00 moves the model
// back on the same day, so the added exception at 21:00 comes last.
export const EDITED_EXCEPTION_OCCURRENCES_WITH_EXCEPTIONS: OccurrenceDetails[] = [
  {
    name: `${EDITED_EXCEPTION_TRAIN_NAME} 1`,
    startTime: '12:00',
    arrivalTime: '12:07',
    rollingStock: slowRollingStockName,
  },
  {
    name: `${EDITED_EXCEPTION_TRAIN_NAME} 3`,
    startTime: '13:00',
    arrivalTime: '13:03',
    rollingStock: fastRollingStockName,
  },
  {
    name: `${EDITED_EXCEPTION_TRAIN_NAME} 5`,
    startTime: '14:00',
    arrivalTime: '14:03',
    rollingStock: fastRollingStockName,
  },
  {
    name: `${EDITED_EXCEPTION_TRAIN_NAME}/+`,
    startTime: '21:00',
    arrivalTime: '21:03',
    rollingStock: fastRollingStockName,
  },
];

export const EDITED_EXCEPTION_OCCURRENCES_AFTER_RESET: OccurrenceDetails[] = [
  {
    name: `${EDITED_EXCEPTION_TRAIN_NAME} 1`,
    startTime: '12:00',
    arrivalTime: '12:03',
    rollingStock: dualModeRollingStockName,
  },
  {
    name: `${EDITED_EXCEPTION_TRAIN_NAME} 3`,
    startTime: '13:00',
    arrivalTime: '13:03',
    rollingStock: dualModeRollingStockName,
  },
  {
    name: `${EDITED_EXCEPTION_TRAIN_NAME} 5`,
    startTime: '14:00',
    arrivalTime: '14:03',
    rollingStock: dualModeRollingStockName,
  },
];

export const ADDED_EXCEPTION_TRAIN_NAME = IMPORTED_PACED_TRAIN_DETAILS[1].name;

export const ADDED_EXCEPTION_INTERVAL_MINUTES = '30';
export const ADDED_EXCEPTION_SERVICE_WINDOW_HOURS = '2';
export const ADDED_EXCEPTION_SERVICE_WINDOW_MINUTES = '00';

export const ADDED_EXCEPTION_DATE = '2025-08-08';
export const ADDED_EXCEPTION_TIME = '12:00:00';

export const ADDED_EXCEPTION_OCCURRENCES_COUNT = 5;

export const ADDED_EXCEPTION_OCCURRENCE_DETAILS: OccurrenceDetails = {
  name: `${ADDED_EXCEPTION_TRAIN_NAME}/+`,
  startTime: '12:00',
  arrivalTime: '12:07',
};

export const OCCURRENCE_EDITION_COMPOSITION_CODE = 'MA100';
export const OCCURRENCE_EDITION_ROUTE_SEARCH = 'WS NES';
export const OCCURRENCE_EDITION_STOP_ROW_FILTER = 'Mid_East_station';
export const OCCURRENCE_EDITION_STOP_DURATION_DIGITS = '18000';
export const OCCURRENCE_EDITION_REQUESTED_DEPARTURE = '02:40:00';

export const OCCURRENCE_EDITION_RESTORED_OCCURRENCE = IMPORT_PACED_TRAIN_OCCURRENCES_DETAILS[4][1];
export const OCCURRENCE_EDITION_REMAINING_OCCURRENCES: OccurrenceDetails[] = [
  IMPORT_PACED_TRAIN_OCCURRENCES_DETAILS[4][0],
  IMPORT_PACED_TRAIN_OCCURRENCES_DETAILS[4][2],
];
