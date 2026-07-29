import type { TrainSchedule } from 'common/api/osrdEditoastApi';

import { readJsonFile } from '../../utils/file-utils';

export const SCENARIO_NAME_PREFIX = 'train-header';

const allTrains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

// "Train21": a plain unique train with no category, MARECO margin, STANDARD comfort.
export const uniqueTrain = allTrains[27];
// "Paced Train - All exceptions": a mission with 2 base occurrences, 1 modified
// occurrence (index 0) and 1 added exception.
export const pacedTrain = allTrains[6];
