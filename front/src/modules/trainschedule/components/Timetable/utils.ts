import specialCodeDictionary from './consts';
import type { TrainScheduleWithDetails } from './types';

/** Filter train schedules by their names and labels */
export const keepTrain = (train: TrainScheduleWithDetails, searchString: string): boolean => {
  if (searchString) {
    const searchStringInName = train.trainName.toLowerCase().includes(searchString.toLowerCase());
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
