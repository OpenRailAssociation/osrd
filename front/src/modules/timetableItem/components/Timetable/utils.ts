import dayjs from 'dayjs';
import { omit } from 'lodash';

import type {
  PacedTrain,
  SubCategory,
  TrainMainCategories,
  TrainSchedule,
} from 'common/api/osrdEditoastApi';
import type { TimetableItem, TimetableItemId } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';
import { isPacedTrainResponseWithPacedTrainId } from 'utils/trainId';

import { specialCodeDictionary } from './consts';
import type { TimetableItemWithDetails } from './types';

/** Filter timetable items by their names and labels */
export const keepItem = (name: string | undefined, labels: string[], searchString: string) => {
  if (!searchString) return true;
  if (!name) return false;
  const isNameFilterInTimetable = name.toLowerCase().includes(searchString.toLowerCase());
  const searchStringInTags = labels.join('').toLowerCase().includes(searchString.toLowerCase());
  return isNameFilterInTimetable || searchStringInTags;
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
  timetableItems.some((timetableItem) => timetableItem.summary && !timetableItem.summary.isValid);

export const formatFullDate = (d: Date) => dayjs(d).format('D/MM/YYYY HH:mm:ss');

export const roundAndFormatToNearestMinute = (d: Date) =>
  dayjs(d)
    .add(d.getSeconds() >= 30 ? 1 : 0, 'minute')
    .format('HH:mm');

export const formatTrainDuration = (duration: Duration) =>
  dayjs.duration(duration.ms).format('HH[h]mm');

export const exportTimetableItems = (
  selectedTimeTableIdsFromClick: TimetableItemId[],
  timetableItems: TimetableItem[]
) => {
  if (!timetableItems) return;

  const formattedTimetableItems = timetableItems
    .filter(({ id }) => selectedTimeTableIdsFromClick.includes(id))
    .reduce<{
      train_schedules: TrainSchedule[];
      paced_trains: PacedTrain[];
    }>(
      (acc, timetableItem) => {
        if (isPacedTrainResponseWithPacedTrainId(timetableItem)) {
          acc.paced_trains.push(omit(timetableItem, ['id']));
        } else {
          acc.train_schedules.push(omit(timetableItem, ['id']));
        }
        return acc;
      },
      { train_schedules: [], paced_trains: [] }
    );

  const jsonString = JSON.stringify(formattedTimetableItems);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'timetable.json';
  a.click();
};

export function extractCategoryId(fullId: string): TrainMainCategories | SubCategory['code'] {
  const [prefix, code] = fullId.split(':');

  if (prefix === 'main' || prefix === 'sub') {
    return code;
  }

  throw new Error(`Unknown category prefix: ${prefix}`);
}
