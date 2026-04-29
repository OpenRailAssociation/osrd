import type {
  PacedTrainResponseWithPaced,
  PacedTrainWithPaced,
} from 'applications/operationalStudies/types';
import type { TrainSchedule, PacedTrainException } from 'common/api/osrdEditoastApi';
import type { OccurrenceId, PacedTrainId, TimetableItem } from 'reducers/osrdconf/types';
import { Duration, addDurationToDate } from 'utils/duration';
import {
  extractEditoastIdFromPacedTrainId,
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
  isAddedExceptionId,
  isIndexedOccurrenceId,
} from 'utils/trainId';

import type {
  ExceptionChangeGroups,
  PacedTrainWithDetails,
  PacedTrainWithPacedWithDetails,
  SimulatedException,
  TrainScheduleWithDetails,
} from '../types';
import computeOccurrenceName from './computeOccurrenceName';

export const isPacedTrainBase = (pacedTrain: TrainSchedule): pacedTrain is PacedTrainWithPaced =>
  !!pacedTrain.paced;

export const CHANGE_GROUP_KEYS: (keyof PacedTrainException)[] = [
  'constraint_distribution',
  'initial_speed',
  'labels',
  'options',
  'path_and_schedule',
  'rolling_stock',
  'rolling_stock_category',
  'speed_limit_tag',
  'start_time',
  'train_name',
];

export const hasNoChangeGroups = (exception: PacedTrainException) =>
  CHANGE_GROUP_KEYS.every((key) => !(key in exception));

export const isPacedTrain = (
  timetableItem: TimetableItem
): timetableItem is PacedTrainResponseWithPaced => !!timetableItem.paced;

export const isPacedTrainWithDetails = (
  trainSchedule: TrainScheduleWithDetails
): trainSchedule is PacedTrainWithPacedWithDetails => !!trainSchedule.paced;

export const getOccurrencesNb = ({
  timeWindow,
  interval,
}: Pick<NonNullable<PacedTrainWithDetails['paced']>, 'timeWindow' | 'interval'>) => {
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
  return exceptions.find(({ id }) => Number(addedExceptionId) === id);
};

export const extractOccurrenceDetailsFromPacedTrain = <
  T extends Omit<TrainSchedule, 'paced' | 'exceptions'>,
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
    occurrence.options!.stops_at_end_of_block =
      exceptionChangeGroups.options.value?.stops_at_end_of_block;
  }
  return occurrence;
};

/** Return the worst status of the model train and its occurrences */
export const getOccurrencesWorstStatus = (
  summary: PacedTrainWithDetails['summary'],
  exceptions: NonNullable<PacedTrainWithDetails['paced']>['exceptions']
): 'invalid' | 'scheduleNotHonored' | 'trainTooFast' | '' => {
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
  timetableItemsById: Map<number, TimetableItem>,
  occurrenceId: OccurrenceId
) => {
  const pacedTrainId = extractEditoastIdFromPacedTrainId(
    extractPacedTrainIdFromOccurrenceId(occurrenceId)
  );
  const pacedTrain = timetableItemsById.get(pacedTrainId);
  if (!pacedTrain) return undefined;
  if (!isPacedTrain(pacedTrain)) throw new Error(`No paced train found for id ${pacedTrainId}`);

  let exception: PacedTrainException | undefined;
  if (isIndexedOccurrenceId(occurrenceId)) {
    const index = extractOccurrenceIndexFromOccurrenceId(occurrenceId);
    exception = pacedTrain.paced.exceptions.find((e) => e.occurrence_index === index);
  } else {
    const id = extractExceptionIdFromOccurrenceId(occurrenceId);
    exception = pacedTrain.paced.exceptions.find((e) => e.id === id);
  }
  return exception;
};

/**
 * Compute the train_name for an occurrence, taking into account any existing exception override.
 * - If an exception already overrides train_name, use that value.
 * - For indexed occurrences, compute the name from the base name + index.
 * - For added exceptions, use `baseName/+`.
 */
export const getOccurrenceTrainName = (
  pacedTrain: Pick<PacedTrainWithPaced, 'train_name' | 'paced'>,
  occurrenceId: OccurrenceId
): string => {
  const existingException = findExceptionWithOccurrenceId(
    pacedTrain.paced.exceptions,
    occurrenceId
  );

  if (existingException?.train_name?.value) {
    return existingException.train_name.value;
  }

  if (isIndexedOccurrenceId(occurrenceId)) {
    return computeOccurrenceName(
      pacedTrain.train_name,
      extractOccurrenceIndexFromOccurrenceId(occurrenceId)
    );
  }

  return `${pacedTrain.train_name}/+`;
};

/**
 * Return true if the exception has at least one change group defined (excluding disabled).
 */
export const hasChangeGroups = (exception: SimulatedException): boolean =>
  exception.constraint_distribution != null ||
  exception.initial_speed != null ||
  exception.labels != null ||
  exception.options != null ||
  exception.path_and_schedule != null ||
  exception.rolling_stock != null ||
  exception.rolling_stock_category != null ||
  exception.speed_limit_tag != null ||
  exception.start_time != null ||
  exception.train_name != null;

/**
 * Return true if the exception has at least one change group defined OR is disabled.
 * Use this to decide whether an exception should stay in the list at all.
 */
export const hasExceptions = (exception: SimulatedException): boolean =>
  exception.disabled === true || hasChangeGroups(exception);

export const getOcurrencesIds = (pacedTrain: PacedTrainWithPaced, pacedTrainId: PacedTrainId) => {
  const occurrencesIds: OccurrenceId[] = pacedTrain.paced.exceptions
    .filter((exception) => exception.occurrence_index === undefined) // Indexed exceptions follow the regular indexed occurrence id pattern
    // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
    .map((exception) => formatPacedTrainIdToExceptionId(pacedTrainId, exception.id!));
  const indexedOccurrencesCount = getOccurrencesNb({
    timeWindow: Duration.parse(pacedTrain.paced.time_window),
    interval: Duration.parse(pacedTrain.paced.interval),
  });
  for (let i = 0; i < indexedOccurrencesCount; i += 1) {
    occurrencesIds.push(formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, i));
  }
  return occurrencesIds;
};

export const isOccurrencePresentInPacedTrain = (
  occurrenceId: OccurrenceId,
  trainSchedule: Pick<TrainScheduleWithDetails, 'paced' | 'id'>
): boolean => {
  const paced = trainSchedule.paced;
  if (!paced) return false;

  const pacedTrainId = extractPacedTrainIdFromOccurrenceId(occurrenceId);
  if (extractEditoastIdFromPacedTrainId(pacedTrainId) !== trainSchedule.id) return false;

  if (isAddedExceptionId(occurrenceId)) {
    const exceptionId = extractExceptionIdFromOccurrenceId(occurrenceId);
    return paced.exceptions.some((exception) => exception.id === exceptionId);
  }

  const occurrenceIndex = extractOccurrenceIndexFromOccurrenceId(occurrenceId);
  const isDisabledException = paced.exceptions.find(
    (exception) => exception.occurrence_index === occurrenceIndex
  )?.disabled;
  if (isDisabledException) return false;

  return occurrenceIndex >= 0 && occurrenceIndex < getOccurrencesNb(paced);
};
