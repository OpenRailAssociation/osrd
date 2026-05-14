import type { PacedTrainResponse, PacedTrain } from 'applications/operationalStudies/types';
import type {
  TrainSchedule,
  PacedTrainException,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import type { OccurrenceId, PacedTrainId, TrainId } from 'reducers/osrdconf/types';
import { Duration, addDurationToDate } from 'utils/duration';
import {
  extractEditoastIdFromPacedTrainId,
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  extractEditoastIdFromTrainId,
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
  isAddedExceptionId,
  isIndexedOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';

import type {
  ExceptionChangeGroups,
  PacedTrainWithDetails,
  SimulatedException,
  TrainScheduleWithDetails,
} from '../types';
import computeOccurrenceName from './computeOccurrenceName';

export const isPacedTrainBase = (pacedTrain: TrainSchedule): pacedTrain is PacedTrain =>
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

export function shiftPacedExceptions(
  exceptions: PacedTrainException[],
  timeDiffMs: number
): PacedTrainException[] {
  return exceptions.map((exc) =>
    exc.start_time ? { ...exc, start_time: { value: exc.start_time.value + timeDiffMs } } : exc
  );
}

/**
 * Return `train` with its paced exceptions replaced by `exceptions`. No-op (returns `train`
 * unchanged) when there is nothing to apply: `exceptions` is undefined or the train is not paced.
 */
export const withPacedExceptions = <
  T extends { paced?: { exceptions: PacedTrainException[] } | null },
>(
  train: T,
  exceptions: PacedTrainException[] | undefined
): T => (exceptions && train.paced ? { ...train, paced: { ...train.paced, exceptions } } : train);

export const isPacedTrain = (
  trainSchedule: TrainScheduleResponse
): trainSchedule is PacedTrainResponse => !!trainSchedule.paced;

export const isPacedTrainWithDetails = (
  trainSchedule: TrainScheduleWithDetails
): trainSchedule is PacedTrainWithDetails => !!trainSchedule.paced;

export const getOccurrencesNb = ({
  timeWindow,
  interval,
}: Pick<PacedTrainWithDetails['paced'], 'timeWindow' | 'interval'>) => {
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

/**
 * Given a train ID, return its train schedule and exception.
 *
 * The train schedule is unset if the train is not found. The exception is
 * unset if the train is not an exception (e.g. unique train schedule or
 * regular occurrence).
 */
export function findTrainScheduleAndException(
  trainSchedules: TrainScheduleWithDetails[],
  trainId: TrainId
): {
  trainSchedule: TrainScheduleWithDetails | undefined;
  exception: SimulatedException | undefined;
} {
  const trainScheduleId = extractEditoastIdFromTrainId(trainId);
  const trainSchedule = trainSchedules.find((ts) => ts.id === trainScheduleId);
  if (!trainSchedule || !isOccurrenceId(trainId)) {
    return { trainSchedule, exception: undefined };
  }
  if (!trainSchedule.paced) {
    throw new Error('Occurrence ID references a unique train');
  }

  const exception = findExceptionWithOccurrenceId(trainSchedule.paced.exceptions, trainId);
  if (isAddedExceptionId(trainId) && !exception) {
    throw new Error('Occurrence ID references a non-existing exception ID');
  }

  return { trainSchedule, exception };
}

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
    // options is optional when creating a train schedule but
    // is always present when editing an existing one
    occurrence.options = {
      ...occurrence.options,
      use_electrical_profiles: exceptionChangeGroups.options.value?.use_electrical_profiles,
      use_speed_limits_for_simulation:
        exceptionChangeGroups.options.value?.use_speed_limits_for_simulation,
      stops_at_end_of_block: exceptionChangeGroups.options.value?.stops_at_end_of_block,
    };
  }
  return occurrence;
};

/** Return the worst status of the model train and its occurrences */
export const getOccurrencesWorstStatus = (
  summary: PacedTrainWithDetails['summary'],
  exceptions: PacedTrainWithDetails['paced']['exceptions']
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
  trainSchedulesById: Map<number, TrainScheduleResponse>,
  occurrenceId: OccurrenceId
) => {
  const pacedTrainId = extractEditoastIdFromPacedTrainId(
    extractPacedTrainIdFromOccurrenceId(occurrenceId)
  );
  const pacedTrain = trainSchedulesById.get(pacedTrainId);
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
  pacedTrain: Pick<PacedTrain, 'train_name' | 'paced'>,
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
  Boolean(
    exception.constraint_distribution ||
    exception.initial_speed ||
    exception.labels ||
    exception.options ||
    exception.path_and_schedule ||
    exception.rolling_stock ||
    exception.rolling_stock_category ||
    exception.speed_limit_tag ||
    exception.start_time ||
    exception.train_name
  );

/**
 * Return true if the exception has at least one change group defined OR is disabled.
 * Use this to decide whether an exception should stay in the list at all.
 */
export const hasExceptions = (exception: SimulatedException): boolean =>
  exception.disabled === true || hasChangeGroups(exception);

export const getOccurrencesIds = (pacedTrain: PacedTrain, pacedTrainId: PacedTrainId) => {
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

/**
 * Returns the id of the earliest active occurrence of the paced train. An
 * occurrence is considered active when it is not disabled by an exception.
 * Both indexed slots (with or without `start_time` override) and added
 * exceptions are taken into account. Used as a fallback when no occurrence
 * has been clicked yet but the panel switches to `single` mode.
 */
export const getFirstActiveOccurrenceId = (
  pacedTrain: PacedTrainWithDetails,
  pacedTrainId: PacedTrainId
): OccurrenceId | undefined => {
  const { paced } = pacedTrain;
  const startTimeMs = pacedTrain.startTime.getTime();
  const intervalMs = paced.interval.ms;

  let bestId: OccurrenceId | undefined;
  let bestTimeMs = Infinity;

  const slotCount = getOccurrencesNb(paced);
  for (let i = 0; i < slotCount; i += 1) {
    const indexedException = paced.exceptions.find((e) => e.occurrence_index === i);
    if (indexedException?.disabled) continue;
    const timeMs = indexedException?.start_time?.value ?? startTimeMs + i * intervalMs;
    if (timeMs < bestTimeMs) {
      bestTimeMs = timeMs;
      bestId = formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, i);
    }
  }

  for (const exception of paced.exceptions) {
    if (exception.occurrence_index !== undefined || !exception.start_time || !exception.id)
      continue;
    if (exception.start_time.value < bestTimeMs) {
      bestTimeMs = exception.start_time.value;
      bestId = formatPacedTrainIdToExceptionId(pacedTrainId, exception.id);
    }
  }

  return bestId;
};
