import type { TrainSchedule } from 'common/api/osrdEditoastApi';

import { readJsonFile } from '../../utils/file-utils';
import type { ManageTrainScheduleTranslations } from '../../utils/types';

export const SCENARIO_NAME_PREFIX = 'train-header';

export const NO_COMPOSITION_CODE_VALUE = '__PLACEHOLDER__';

export const frTranslations: ManageTrainScheduleTranslations = readJsonFile<{
  manageTrainSchedule: ManageTrainScheduleTranslations;
}>('public/locales/fr/operational-studies.json').manageTrainSchedule;

type RollingStockTranslations = {
  shortCategoriesOptions: Record<string, string>;
};

export const frRollingStockTranslations: RollingStockTranslations = readJsonFile<{
  rollingStock: RollingStockTranslations;
}>('public/locales/fr/translation.json').rollingStock;

const allTrains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

// "Train21": a plain unique train with no category, MARECO margin, STANDARD comfort.
export const uniqueTrain = allTrains[27];
// "Paced Train - All exceptions": a mission with 2 base occurrences, 1 modified
// occurrence (index 0) and 1 added exception.
export const pacedTrain = allTrains[6];
