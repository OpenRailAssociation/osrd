import dayjs from 'dayjs';
import { omit, sortBy } from 'lodash';

import type {
  PacedTrain,
  TrainSchedule,
  LightRollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import {
  findExceptionWithOccurrenceId,
  getOccurrencesNb,
} from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItem, TimetableItemId } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';
import {
  isPacedTrainResponseWithPacedTrainId,
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
} from 'utils/trainId';

import { specialCodeDictionary } from './consts';
import type { Occurrence, PacedTrainWithDetails, TimetableItemWithDetails } from './types';

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

export function generatePacedTrainOccurrences(
  pacedTrain: PacedTrainWithDetails,
  rollingStockList: LightRollingStockWithLiveries[] | null
) {
  const {
    id,
    paced,
    name,
    rollingStock,
    stopsCount,
    exceptions,
    category: pacedTrainCategory,
    summary,
  } = pacedTrain;

  const occurrencesCount = getOccurrencesNb(paced);

  const computedOccurrences: Occurrence[] = [];

  // Handle indexed occurrences
  for (let i = 0; i < occurrencesCount; i += 1) {
    const occurrenceId = formatPacedTrainIdToIndexedOccurrenceId(id, i);

    const correspondingException = findExceptionWithOccurrenceId(exceptions, occurrenceId);

    let occurrenceRollingStock = rollingStock;
    if (correspondingException?.rolling_stock && rollingStockList) {
      const rollingStockName = correspondingException.rolling_stock.rolling_stock_name;
      occurrenceRollingStock = rollingStockList.find((rs) => rs.name === rollingStockName);
    }

    const startTime = correspondingException?.start_time?.value
      ? new Date(correspondingException.start_time.value)
      : dayjs(pacedTrain.startTime)
          .add(i * paced.interval.ms, 'ms')
          .toDate();

    computedOccurrences.push({
      id: occurrenceId,
      trainName: correspondingException?.train_name?.value ?? computeOccurrenceName(name, i),
      rollingStock: occurrenceRollingStock,
      startTime,
      stopsCount: correspondingException?.path_and_schedule
        ? correspondingException.path_and_schedule.schedule.filter((step) => step.stop_for).length
        : stopsCount,
      disabled: correspondingException?.disabled,
      // In the model, we can currently have a null category value so we need to handle this case
      category: correspondingException?.rolling_stock_category
        ? correspondingException.rolling_stock_category.value
        : pacedTrainCategory,
      occurrenceIndex: i,
      exceptionChangeGroups: correspondingException
        ? omit(correspondingException, ['key', 'occurrence_index', 'disabled', 'summary'])
        : undefined,
      summary: correspondingException?.summary ?? summary,
    });
  }

  // Handle added exceptions
  exceptions.forEach((exception) => {
    if (exception.occurrence_index !== undefined) return;

    let occurrenceRollingStock = rollingStock;
    if (exception.rolling_stock && rollingStockList) {
      const rollingStockName = exception.rolling_stock.rolling_stock_name;
      occurrenceRollingStock = rollingStockList.find((rs) => rs.name === rollingStockName);
    }

    // An added exception will always have a least a start time in its exceptions
    const startTime = new Date(exception.start_time!.value);

    computedOccurrences.push({
      id: formatPacedTrainIdToExceptionId(id, exception.key),
      trainName: exception.train_name?.value ?? `${name}/+`,
      rollingStock: occurrenceRollingStock,
      // An added exception will always have a least a start time in its exceptions
      startTime,
      stopsCount: exception.path_and_schedule
        ? exception.path_and_schedule.schedule.filter((step) => step.stop_for).length
        : stopsCount,
      // In the model, we can currently have a null category value so we need to handle this case
      category: exception.rolling_stock_category
        ? exception.rolling_stock_category.value
        : pacedTrainCategory,
      exceptionChangeGroups: omit(exception, ['key', 'disabled', 'occurrence_index', 'summary']),
      summary: exception.summary ?? summary,
    });
  });

  return sortBy(computedOccurrences, 'startTime');
}
