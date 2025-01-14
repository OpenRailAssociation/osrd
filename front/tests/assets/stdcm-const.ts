export const CI_SUGGESTIONS = {
  north: ['NES North_East_station', 'NS North_station', 'NWS North_West_station'],
  south: ['SES South_East_station', 'SS South_station', 'SWS South_West_station'],
};

export const DEFAULT_DETAILS = {
  chValue: 'BV',
  arrivalDate: '17/10/24',
  arrivalTime: '00:00',
  tolerance: '-30/+30',
  speedLimitTag: '__PLACEHOLDER__', // value = None
};

export const ORIGIN_DETAILS = {
  input: 'North',
  suggestion: 'North_West_station',
  ...DEFAULT_DETAILS,
  updatedChValue: 'BC',
  arrivalType: {
    default: 'preciseTime',
    updated: 'respectDestinationSchedule',
  },
};

export const DESTINATION_DETAILS = {
  input: 'South',
  suggestion: 'South_station',
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
