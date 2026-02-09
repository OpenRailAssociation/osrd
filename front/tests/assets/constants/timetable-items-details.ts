import { readJsonFile } from '../../utils/file-utils';
import type { TimetableFilterTranslations } from '../../utils/types';
const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

export const EXPECTED_COUNTS = {
  totalPacedTrainCount: 4,
  totalUniqueTrainCount: 7,
};

export type DetailRow = {
  stopsCount: string;
  pathLength: string;
  energyConsumed: string;
  durationTime: string;
};

function itemStops(number: string): string {
  return frScenarioTranslations.timetable.stopsCount_other.replace('{{count}}', number);
}

const itemStopSingular = frScenarioTranslations.timetable.stopsCount_one;
const itemStopZero = frScenarioTranslations.timetable.stopsCount_zero;

export const PACED_DETAILS: DetailRow[] = [
  {
    stopsCount: itemStopSingular,
    pathLength: '34.0 km',
    energyConsumed: '808 kWh',
    durationTime: '00h19',
  },
  {
    stopsCount: itemStopSingular,
    pathLength: '47.7 km',
    energyConsumed: '558 kWh',
    durationTime: '00h21',
  },
];

export const UNIQUE_TRAIN_DETAILS: DetailRow[] = [
  {
    stopsCount: itemStopZero,
    pathLength: '6.8 km',
    energyConsumed: '11 kWh',
    durationTime: '00h06',
  },
  {
    stopsCount: itemStopSingular,
    pathLength: '45.9 km',
    energyConsumed: '1390 kWh',
    durationTime: '00h18',
  },
  {
    stopsCount: itemStopZero,
    pathLength: '34.0 km',
    energyConsumed: '1459 kWh',
    durationTime: '00h09',
  },
  {
    stopsCount: itemStops('2'),
    pathLength: '47.5 km',
    energyConsumed: '912 kWh',
    durationTime: '03h11',
  },
];
