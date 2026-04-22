import { readJsonFile } from '../../../utils/file-utils';
import type { ConsistFields, ViaSearchText } from '../../../utils/stdcm-types';
import type { StdcmTranslations } from '../../../utils/types';
import { electricRollingStockName } from '../project-const';

export const STDCM_TRANSLATIONS: StdcmTranslations = readJsonFile('public/locales/fr/stdcm.json');

export const EMPTY_SELECT_VALUE = '__PLACEHOLDER__';

export const STDCM_URL = '/stdcm';

export const ALL_STOPS_TABLE_DATA_PATH = './tests/assets/stdcm/stdcm-all-stops.json';

export const ANTERIOR_LINKED_TRAIN_TABLE_DATA_PATH =
  './tests/assets/stdcm/linked-train/anterior-linked-train-table.json';

export const POSTERIOR_LINKED_TRAIN_TABLE_DATA_PATH =
  './tests/assets/stdcm/linked-train/posterior-linked-train-table.json';

export const TOWED_ROLLING_STOCK_TABLE_DATA_PATH =
  './tests/assets/stdcm/towed-rolling-stock/towed-rolling-stock-table-result.json';

export const STDCM_WITHOUT_ALL_VIA_DATA_PATH = './tests/assets/stdcm/stdcm-without-all-via.json';

export const STDCM_WITH_ALL_VIA_DATA_PATH = './tests/assets/stdcm/stdcm-with-all-via.json';

export const CI_SUGGESTIONS = {
  north: ['NES North_East_station', 'NS North_station', 'NWS North_West_station'],
  south: ['SES South_East_station', 'SS South_station', 'SWS South_West_station'],
};

export const VIA_SUGGESTIONS = ['MWS Mid_West_station', 'MES Mid_East_station', 'NS North_station'];

export const DEFAULT_DETAILS = {
  chValue: 'BV',
  arrivalDate: '17/10/24',
  arrivalTime: '00:00',
  tolerance: '-30/+30',
  speedLimitTag: 'MA100',
  maxSpeed: '100',
};

export const ORIGIN_DETAILS = {
  input: 'North',
  suggestion: 'NWS North_West_station',
  ...DEFAULT_DETAILS,
  updatedChValue: 'BC',
  arrivalType: {
    default: 'preciseTime',
    updated: 'respectDestinationSchedule',
  },
};

export const DESTINATION_DETAILS = {
  input: 'South',
  suggestion: 'SS South_station',
  ...DEFAULT_DETAILS,
  arrivalType: {
    default: 'asSoonAsPossible',
    updated: 'preciseTime',
  },
  updatedDetails: {
    date: '18/10/24',
    hour: '01',
    minute: '35',
    timeValue: '01:37',
    tolerance: {
      negative: '-75',
      positive: '+45',
    },
  },
};

export const LIGHT_ORIGIN_DETAILS = {
  input: 'North',
  chValue: DEFAULT_DETAILS.chValue,
  arrivalType: 'preciseTime',
  arrivalDate: DEFAULT_DETAILS.arrivalDate,
  arrivalTime: '20:21',
  tolerance: {
    negative: '-60',
    positive: '+15',
  },
};

export const LIGHT_DESTINATION_DETAILS = {
  input: 'South',
  chValue: DEFAULT_DETAILS.chValue,
  arrivalType: 'asSoonAsPossible',
};

export const VIA_STOP_TIMES = {
  serviceStop: {
    default: '0',
    input: '3',
  },
  driverSwitch: {
    default: '3',
    invalidInput: '2',
    validInput: '4',
  },
};

export const VIA_STOP_TYPES = {
  PASSAGE_TIME: 'passageTime',
  SERVICE_STOP: 'serviceStop',
  DRIVER_SWITCH: 'driverSwitch',
};

export const CONFLICT_ARRIVAL_TIME = '16:29';

export const CONSIST_DETAILS: ConsistFields = {
  tractionEngine: electricRollingStockName,
  tonnage: '950',
  length: '567',
  speedLimitTag: 'HLP',
  maxSpeed: '100',
};

export const TRACTION_ENGINE_PREFILLED_VALUES = { tonnage: '900', length: '400', maxSpeed: '288' };

export const FAST_ROLLING_STOCK_PREFILLED_VALUES = {
  tonnage: '190',
  length: '46',
  maxSpeed: '220',
};

export const TOWED_ROLLING_STOCK_PREFILLED_VALUES = {
  tonnage: '46',
  length: '26',
  maxSpeed: '180',
};

export const VIA_DETAILS: { viaNumber: number; ciSearchText: ViaSearchText }[] = [
  { viaNumber: 1, ciSearchText: 'mid_west' },
  { viaNumber: 2, ciSearchText: 'mid_east' },
  { viaNumber: 3, ciSearchText: 'nS' },
];

export const SIMULATION_RESULTS_DETAILS = {
  simulationIndex: 0,
  simulationLengthAndDuration: '51 km — 33min',
  validSimulationNumber: 1,
};

export const SIMULATION_RESULTS_WITH_STOPS_DETAILS = {
  simulationIndex: 0,
  simulationLengthAndDuration: '51 km — 1h 17min',
  validSimulationNumber: 1,
};

export const ALTERNATIVE_SIMULATION_RESULTS_DETAILS = {
  simulationIndex: 1,
  simulationLengthAndDuration: '51 km — 2h 35min',
  validSimulationNumber: 1,
};

export const MISSING_FIELDS_SIMULATION_RESULTS_DETAILS = {
  simulationIndex: 1,
  simulationLengthAndDuration: '51 km — 22min',
  validSimulationNumber: 2,
};

export const INVALID_CONSIST_DATA = {
  invalidTonnage: '30',
  invalidLength: '12',
  invalidMaxSpeed: '7',
};

export const VALID_CONSIST_DATA = {
  validTonnage: '900',
  validLength: '400',
  validMaxSpeed: '160',
};
