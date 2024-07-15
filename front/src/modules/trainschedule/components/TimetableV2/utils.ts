import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';

import { specialCodeDictionary } from './consts';
import type { TrainScheduleWithDetails } from './types';

/**
 * Filter train schedules by their names and labels
 */
export const keepTrain = (train: TrainScheduleBase, searchString: string): boolean => {
  if (searchString) {
    const searchStringInName = train.train_name.toLowerCase().includes(searchString.toLowerCase());
    const searchStringInTags = train.labels
      ? train.labels.join('').toLowerCase().includes(searchString.toLowerCase())
      : false;
    return searchStringInName || searchStringInTags;
  }
  return true;
};

export const extractTagCode = (tag?: string | null) => {
  if (!tag) {
    return 'NO CODE';
  }
  if (tag in specialCodeDictionary) {
    return specialCodeDictionary[tag];
  }

  const matches = tag.match(/\w+$/);
  return matches ? matches[0] : tag;
};

export const timetableHasInvalidTrain = (trains: TrainScheduleWithDetails[]) =>
  trains.some((train) => train.invalidReason);

export const transformDateWithoutYear = (dateTime: string): string =>
  `${dateTime.split('/')[0]}/${dateTime.split('/')[1]} ${dateTime.split('/')[2].slice(5)} `;
