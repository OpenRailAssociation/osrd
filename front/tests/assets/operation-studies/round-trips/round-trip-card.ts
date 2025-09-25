import readJsonFile from '../../../utils/file-utils';
import type { FlatTranslations, RoundTripCardExpected } from '../../../utils/types';

const frTranslations: FlatTranslations = readJsonFile<{
  main: FlatTranslations;
}>('public/locales/fr/operational-studies.json').main;

const requestedPointKey = frTranslations.requestedPointUnknown;

export const FirstPacedTrain: RoundTripCardExpected = {
  title: 'Paced Train - Added exception',
  interval: '60’',
  stops: '0',
  origin: 'South_station BV',
  destination: 'North_station BV',
  startTime: '00',
  requestedArrivalTime: '07',
};

export const SecondPacedTrain: RoundTripCardExpected = {
  title: 'Paced Train - All exceptions',
  interval: '65’',
  stops: '1',
  origin: 'North_East_station BV',
  destination: requestedPointKey,
  startTime: '48',
  requestedArrivalTime: '?',
};

export const ThirdPacedTrain: RoundTripCardExpected = {
  title: 'Paced Train - Updated and added exception (RS)',
  interval: '60’',
  stops: '0',
  origin: 'South_station BV',
  destination: 'North_station BV',
  startTime: '00',
  requestedArrivalTime: '?',
};

export const FirstTrainSchedule: RoundTripCardExpected = {
  title: 'Train19',
  interval: '–',
  stops: '0',
  origin: requestedPointKey,
  destination: requestedPointKey,
  startTime: '55',
  requestedArrivalTime: '?',
};

export const SecondTrainSchedule: RoundTripCardExpected = {
  title: 'Train20',
  interval: '–',
  stops: '2',
  origin: 'South_station BV',
  destination: 'West_station BV',
  startTime: '59',
  requestedArrivalTime: '01',
};

export const ThirdTrainSchedule: RoundTripCardExpected = {
  title: 'Train21',
  interval: '–',
  stops: '2',
  origin: 'North_East_station BV',
  destination: 'North_West_station BC',
  startTime: '05',
  requestedArrivalTime: '?',
};
