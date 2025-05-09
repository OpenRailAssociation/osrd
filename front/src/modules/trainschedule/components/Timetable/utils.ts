import dayjs from 'dayjs';

import type { Duration } from 'utils/duration';

import { specialCodeDictionary } from './consts';
import type { TimetableItemWithDetails } from './types';

/** Filter timetable items by their names and labels */
export const keepItem = (item: TimetableItemWithDetails, searchString: string): boolean => {
  if (searchString) {
    const searchStringInName = item.name.toLowerCase().includes(searchString.toLowerCase());
    const searchStringInTags = item.labels
      ? item.labels.join('').toLowerCase().includes(searchString.toLowerCase())
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

export const timetableHasInvalidItem = (timetableItems: TimetableItemWithDetails[]) =>
  timetableItems.some((timetableItem) => timetableItem.invalidReason);

export const formatFullDate = (d: Date) => dayjs(d).format('D/MM/YYYY HH:mm:ss');

export const roundAndFormatToNearestMinute = (d: Date) =>
  dayjs(d)
    .add(d.getSeconds() >= 30 ? 1 : 0, 'minute')
    .format('HH:mm');

export const formatTrainDuration = (duration: Duration) =>
  dayjs.duration(duration.ms).format('HH[h]mm');
