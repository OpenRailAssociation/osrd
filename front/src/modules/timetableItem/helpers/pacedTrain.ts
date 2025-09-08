import type { PacedTrain, PacedTrainException } from 'common/api/osrdEditoastApi';
import type {
  OccurrenceId,
  PacedTrainId,
  TimetableItem,
  TimetableItemId,
} from 'reducers/osrdconf/types';
import { Duration, addDurationToDate } from 'utils/duration';
import {
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
  isIndexedOccurrenceId,
  isPacedTrainResponseWithPacedTrainId,
} from 'utils/trainId';

import type { ExceptionChangeGroups, PacedTrainWithDetails } from '../types';

export const getOccurrencesNb = ({ timeWindow, interval }: PacedTrainWithDetails['paced']) => {
  if (interval.ms === 0) {
    throw new Error('Interval cannot be 0');
  }
  return Math.ceil(timeWindow.ms / interval.ms);
};

/** startTime + index × interval */
export const computeIndexedOccurrenceStartTime = (
  pacedTrainStartTime: Date,
  interval: Duration,
  index: number
) => addDurationToDate(pacedTrainStartTime, new Duration({ milliseconds: index * interval.ms }));

/**
 * Based on an exception list and an occurrence id, find the corresponding exception
 */
export const findExceptionWithOccurrenceId = <T extends PacedTrainException>(
  exceptions: T[],
  occurrenceId: OccurrenceId
) => {
  if (isIndexedOccurrenceId(occurrenceId)) {
    const occurrenceToUpdateIndex = extractOccurrenceIndexFromOccurrenceId(occurrenceId);

    return exceptions.find((exception) => exception.occurrence_index === occurrenceToUpdateIndex);
  }
  const addedExceptionId = extractExceptionIdFromOccurrenceId(occurrenceId);
  return exceptions.find(({ key }) => addedExceptionId === key);
};

export const extractOccurrenceDetailsFromPacedTrain = <
  T extends Omit<PacedTrain, 'paced' | 'exceptions'>,
>(
  pacedTrain: T,
  exceptionChangeGroups: ExceptionChangeGroups | undefined
) => {
  const occurrence = { ...pacedTrain };

  if (!exceptionChangeGroups) {
    return occurrence;
  }

  if (exceptionChangeGroups.train_name) {
    occurrence.train_name = exceptionChangeGroups.train_name.value;
  }
  if (exceptionChangeGroups.start_time) {
    occurrence.start_time = exceptionChangeGroups.start_time.value;
  }
  if (exceptionChangeGroups.speed_limit_tag) {
    // speed limit tag will always be a string or null
    occurrence.speed_limit_tag = exceptionChangeGroups.speed_limit_tag.value!;
  }
  if (exceptionChangeGroups.labels) {
    occurrence.labels = exceptionChangeGroups.labels.value;
  }
  if (exceptionChangeGroups.initial_speed) {
    occurrence.initial_speed = exceptionChangeGroups.initial_speed.value;
  }
  if (exceptionChangeGroups.constraint_distribution) {
    occurrence.constraint_distribution = exceptionChangeGroups.constraint_distribution.value;
  }
  if (exceptionChangeGroups.rolling_stock_category) {
    occurrence.category = exceptionChangeGroups.rolling_stock_category.value;
  }
  if (exceptionChangeGroups.rolling_stock) {
    occurrence.rolling_stock_name = exceptionChangeGroups.rolling_stock.rolling_stock_name;
    occurrence.comfort = exceptionChangeGroups.rolling_stock.comfort;
  }
  if (exceptionChangeGroups.path_and_schedule) {
    occurrence.margins = exceptionChangeGroups.path_and_schedule.margins;
    occurrence.path = exceptionChangeGroups.path_and_schedule.path;
    occurrence.power_restrictions = exceptionChangeGroups.path_and_schedule.power_restrictions;
    occurrence.schedule = exceptionChangeGroups.path_and_schedule.schedule;
  }
  if (exceptionChangeGroups.options) {
    // options is optional when creating a timetable item but
    // is always present when editing an existing one
    occurrence.options!.use_electrical_profiles =
      exceptionChangeGroups.options.value?.use_electrical_profiles;
    occurrence.options!.use_speed_limits_for_simulation =
      exceptionChangeGroups.options.value?.use_speed_limits_for_simulation;
  }
  return occurrence;
};

/** Return the worst status of the model train and its occurrences */
export const getOccurrencesWorstStatus = ({
  summary,
  exceptions,
}: Pick<PacedTrainWithDetails, 'summary' | 'exceptions'>):
  | 'invalid'
  | 'scheduleNotHonored'
  | 'trainTooFast'
  | '' => {
  let className: '' | 'scheduleNotHonored' | 'trainTooFast' = '';

  if (summary) {
    if (!summary.isValid) {
      return 'invalid';
    }
    if (summary.notHonoredReason) {
      className = summary.notHonoredReason;
    }
  }

  for (const exception of exceptions) {
    if (exception.summary && !exception.disabled) {
      if (!exception.summary.isValid) return 'invalid';
      if (exception.summary.notHonoredReason && className !== 'scheduleNotHonored') {
        className = exception.summary.notHonoredReason;
      }
    }
  }
  return className;
};

export const getExceptionFromOccurrenceId = (
  timetableItemsById: Map<TimetableItemId, TimetableItem>,
  occurrenceId: OccurrenceId
) => {
  const pacedTrainId = extractPacedTrainIdFromOccurrenceId(occurrenceId);
  const pacedTrain = timetableItemsById.get(pacedTrainId);
  if (!pacedTrain || !isPacedTrainResponseWithPacedTrainId(pacedTrain))
    throw new Error(`No paced train found for id ${pacedTrainId}`);

  let exception: PacedTrainException | undefined;
  if (isIndexedOccurrenceId(occurrenceId)) {
    const index = extractOccurrenceIndexFromOccurrenceId(occurrenceId);
    exception = pacedTrain.exceptions.find((e) => e.occurrence_index === index);
  } else {
    const key = extractExceptionIdFromOccurrenceId(occurrenceId);
    exception = pacedTrain.exceptions.find((e) => e.key === key);
  }
  return exception;
};

export const getOcurrencesIds = (pacedTrain: PacedTrain, pacedTrainId: PacedTrainId) => {
  const occurrencesIds: OccurrenceId[] = pacedTrain.exceptions
    .filter((exception) => exception.occurrence_index === undefined) // Indexed exceptions follow the regular indexed occurrence id pattern
    .map((exception) => formatPacedTrainIdToExceptionId(pacedTrainId, exception.key));
  const indexedOccurencesCount = getOccurrencesNb({
    timeWindow: Duration.parse(pacedTrain.paced.time_window),
    interval: Duration.parse(pacedTrain.paced.interval),
  });
  for (let i = 0; i < indexedOccurencesCount; i += 1) {
    occurrencesIds.push(formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, i));
  }
  return occurrencesIds;
};
