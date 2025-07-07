import dayjs from 'dayjs';

import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import { getOccurrencesNb } from 'modules/timetableItem/helpers/pacedTrain';
import type { Duration } from 'utils/duration';
import { isPacedTrainWithDetails } from 'utils/trainId';

import { specialCodeDictionary } from './consts';
import type { TimetableItemWithDetails } from './types';

/** Filter timetable items by their names and labels */
export const keepItem = (item: TimetableItemWithDetails, searchString: string): boolean => {
  if (searchString) {
    let hasMatchingExceptions = false;
    const namesToCheck = [item.name];

    if (isPacedTrainWithDetails(item)) {
      hasMatchingExceptions = item.exceptions.some(
        (exception) =>
          exception.train_name?.value.toLowerCase().includes(searchString.toLowerCase()) ||
          exception.labels?.value.some((label) =>
            label.toLowerCase().includes(searchString.toLowerCase())
          )
      );

      // handle occurrence names
      const occurrencesCount = getOccurrencesNb(item.paced);
      for (let i = 0; i < occurrencesCount; i += 1) {
        const occurrenceName = computeOccurrenceName(item.name, i);
        namesToCheck.push(occurrenceName);
      }
      const hasAddedExceptionNotRenamed = item.exceptions.some(
        (exception) => exception.occurrence_index === undefined && !exception.train_name
      );
      if (hasAddedExceptionNotRenamed) namesToCheck.push(`${item.name}/+`); // default added exception name
    }

    const isNameFilterInTimetable = namesToCheck.some((n) =>
      n.toLowerCase().includes(searchString.toLowerCase())
    );
    const searchStringInTags = item.labels
      ? item.labels.join('').toLowerCase().includes(searchString.toLowerCase())
      : false;
    return isNameFilterInTimetable || searchStringInTags || hasMatchingExceptions;
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
