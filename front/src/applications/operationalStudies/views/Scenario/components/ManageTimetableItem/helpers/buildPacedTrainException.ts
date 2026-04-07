import { isEqual, omit } from 'lodash';
import { v4 as uuidV4 } from 'uuid';

import type { PacedTrainWithPaced } from 'applications/operationalStudies/types';
import type { TrainSchedule, PacedTrainException } from 'common/api/osrdEditoastApi';
import computeBasePathStep from 'modules/timetableItem/helpers/computeBasePathStep';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import {
  CHANGE_GROUP_KEYS,
  findExceptionWithOccurrenceId,
  computeIndexedOccurrenceStartTime,
  hasExceptions,
} from 'modules/timetableItem/helpers/pacedTrain';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import { removeElementAtIndex, replaceElementAtIndex } from 'utils/array';
import { Duration } from 'utils/duration';
import {
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  isIndexedOccurrenceId,
} from 'utils/trainId';

/**
 * Compare the original paced train with the one from the occurrence update and
 * fill the original paced train exceptions property every time a field is different
 * the caller is responsible for generating the exception key and occurrence index.
 */
export function generatePacedTrainException(
  updatedOccurrence: TrainSchedule,
  originalPacedTrain: Omit<PacedTrainWithPaced, 'train_schedule_set_id'>,
  occurrenceIndex: number | null = null
  // TODO_EXCEPTION: remove `key`
): Omit<PacedTrainException, 'key' | 'occurrence_index'> {
  const exception: Omit<PacedTrainException, 'key' | 'occurrence_index'> = {};

  if (
    !isEqual(originalPacedTrain.constraint_distribution, updatedOccurrence.constraint_distribution)
  ) {
    exception.constraint_distribution = {
      value: updatedOccurrence.constraint_distribution,
    };
  }

  if (!isEqual(originalPacedTrain.initial_speed, updatedOccurrence.initial_speed)) {
    exception.initial_speed = { value: updatedOccurrence.initial_speed ?? 0 };
  }

  if (!isEqual(originalPacedTrain.labels, updatedOccurrence.labels)) {
    exception.labels = { value: updatedOccurrence.labels ?? [] };
  }

  if (!isEqual(originalPacedTrain.options, updatedOccurrence.options)) {
    exception.options = { value: updatedOccurrence.options ?? {} };
  }

  // Compute first all path steps of both paced trains to compare to facilitate the comparison
  // As the front generates each path step id, between two same pathfinding, ids could be different
  // so we don't want to compare them.
  const originalPacedTrainPathSteps = originalPacedTrain.path.map((_, i) =>
    computeBasePathStep(originalPacedTrain, i)
  );
  const pacedTrainWithOccurrenceChangesPathSteps = updatedOccurrence.path.map((_, i) =>
    computeBasePathStep(updatedOccurrence, i)
  );

  if (
    originalPacedTrainPathSteps.length !== pacedTrainWithOccurrenceChangesPathSteps.length ||
    originalPacedTrainPathSteps.some(
      (pathStep, i) =>
        !isEqual(omit(pathStep, 'id'), omit(pacedTrainWithOccurrenceChangesPathSteps[i], 'id'))
    )
  ) {
    exception.path_and_schedule = {
      margins: updatedOccurrence.margins ?? { boundaries: [], values: ['0%'] },
      path: updatedOccurrence.path,
      power_restrictions: updatedOccurrence.power_restrictions ?? [],
      schedule: updatedOccurrence.schedule ?? [],
    };
  }

  if (
    originalPacedTrain.rolling_stock_name !== updatedOccurrence.rolling_stock_name ||
    !isEqual(originalPacedTrain.comfort, updatedOccurrence.comfort)
  ) {
    exception.rolling_stock = {
      rolling_stock_name: updatedOccurrence.rolling_stock_name,
      comfort: updatedOccurrence.comfort ?? originalPacedTrain.comfort ?? 'STANDARD',
    };
  }

  if (!isEqual(originalPacedTrain.category, updatedOccurrence.category)) {
    exception.rolling_stock_category = { value: updatedOccurrence.category };
  }

  if (
    !isEqual(
      originalPacedTrain.speed_limit_tag ?? null,
      // speed limit tag is instantiated with null if not present when formatting the item
      updatedOccurrence.speed_limit_tag ?? null
    )
  ) {
    exception.speed_limit_tag = { value: updatedOccurrence.speed_limit_tag };
  }

  // Custom compare for start time as each indexed occurrence has its own built start time
  let originalStartTimeToTest = new Date(originalPacedTrain.start_time);

  if (occurrenceIndex !== null) {
    const originalPacedTrainInterval = Duration.parse(originalPacedTrain.paced.interval);
    originalStartTimeToTest = computeIndexedOccurrenceStartTime(
      originalStartTimeToTest,
      originalPacedTrainInterval,
      occurrenceIndex
    );
  }
  // Remove milliseconds to avoid issues with the comparison
  originalStartTimeToTest.setMilliseconds(0);
  const pacedTrainStartTime = new Date(updatedOccurrence.start_time);
  pacedTrainStartTime.setMilliseconds(0);

  if (occurrenceIndex === null || !isEqual(originalStartTimeToTest, pacedTrainStartTime)) {
    exception.start_time = { value: updatedOccurrence.start_time };
  }

  // Custom compare for name as each occurrence has its own built name
  let originalTrainNameToTest = originalPacedTrain.train_name;
  if (occurrenceIndex !== null) {
    originalTrainNameToTest = computeOccurrenceName(originalTrainNameToTest, occurrenceIndex);
  } else {
    // If the occurrence is an added exception, we pass its standard name format
    originalTrainNameToTest = `${originalTrainNameToTest}/+`;
  }
  if (!isEqual(originalTrainNameToTest, updatedOccurrence.train_name)) {
    exception.train_name = { value: updatedOccurrence.train_name };
  }

  return exception;
}

/**
 * Based on a new exception, update the current exceptions list by adding, updating or removing it.
 */
export function updatePacedTrainExceptionsList<T extends PacedTrainException>(
  currentExceptions: T[],
  newException: T,
  occurrenceId: OccurrenceId
): T[] {
  // Check if there are change groups in this exception or if it is disabled.
  const isStillException = hasExceptions(newException);
  const exceptionToUpdate = findExceptionWithOccurrenceId(currentExceptions, occurrenceId);

  // If the exception was not already present and it has some change groups, add it.
  // Return the current exceptions list otherwise.
  if (!exceptionToUpdate) {
    return isStillException ? [...currentExceptions, newException] : currentExceptions;
  }

  // If the exception was already present, find it and replace it by the updated one
  let exceptionIndex: number;
  if (isIndexedOccurrenceId(occurrenceId)) {
    const occurrenceToUpdateIndex = extractOccurrenceIndexFromOccurrenceId(occurrenceId);

    exceptionIndex = currentExceptions.findIndex(
      (_exception) => _exception.occurrence_index === occurrenceToUpdateIndex
    );
  } else {
    const addedExceptionId = extractExceptionIdFromOccurrenceId(occurrenceId);
    exceptionIndex = currentExceptions.findIndex(({ id }) => addedExceptionId === id);
  }

  // If yes we replace the exception at the found index, otherwise we remove it
  return isStillException
    ? replaceElementAtIndex(currentExceptions, exceptionIndex, newException)
    : removeElementAtIndex(currentExceptions, exceptionIndex);
}

/**
 * Build a PacedTrain with an updated or new exception for a specific occurrence.
 * This centralizes the pattern of generating an exception and updating the exceptions list.
 */
export function buildPacedTrainWithUpdatedException(
  originalPacedTrain: PacedTrainWithPaced,
  updatedOccurrence: TrainSchedule,
  occurrenceId: OccurrenceId
): PacedTrainWithPaced {
  const occurrenceIndex = isIndexedOccurrenceId(occurrenceId)
    ? extractOccurrenceIndexFromOccurrenceId(occurrenceId)
    : undefined;

  const baseException = generatePacedTrainException(
    updatedOccurrence,
    originalPacedTrain,
    occurrenceIndex ?? null
  );

  const existingException = findExceptionWithOccurrenceId(
    originalPacedTrain.paced.exceptions,
    occurrenceId
  );

  const updatedExceptions = updatePacedTrainExceptionsList(
    originalPacedTrain.paced.exceptions,
    {
      ...baseException,
      key: existingException?.key ?? uuidV4(),
      occurrence_index: occurrenceIndex,
    },
    occurrenceId
  );

  return {
    ...originalPacedTrain,
    paced: { ...originalPacedTrain.paced, exceptions: updatedExceptions },
  };
}

type CheckChangeGroupsResult = {
  exceptions: PacedTrainException[];
  modifiedExceptions: PacedTrainException[];
  exceptionsToDeleteIds: number[];
};

/**
 * This function is called after updating a paced train when the user sends the form.
 * It checks if an exception change group can be removed.
 * If the change group value in the paced train matches the exceptions, the exception change group is removed.
 * If the exceptions as no change group after those checks, the exception is removed.
 *
 * Returns the cleaned exceptions list, along with modified exceptions and ids to delete.
 */
export function checkChangeGroups(
  updatedTrain: TrainSchedule,
  paced: NonNullable<TrainSchedule['paced']>,
  originalExceptions: PacedTrainException[]
): CheckChangeGroupsResult {
  return originalExceptions.reduce<CheckChangeGroupsResult>(
    (acc, exception) => {
      const updatedException = { ...exception };
      if (
        exception.constraint_distribution &&
        isEqual(exception.constraint_distribution.value, updatedTrain.constraint_distribution)
      ) {
        delete updatedException.constraint_distribution;
      }

      if (
        exception.initial_speed &&
        isEqual(exception.initial_speed.value, updatedTrain.initial_speed)
      ) {
        delete updatedException.initial_speed;
      }

      if (exception.labels && isEqual(exception.labels.value, updatedTrain.labels)) {
        delete updatedException.labels;
      }

      if (exception.options && isEqual(exception.options, updatedTrain.options)) {
        delete updatedException.options;
      }

      // Compute first all path steps of the exception and the updated paced train to facilitate the comparison
      // As the front generates each path step id, between two same pathfinding, ids could be different
      // so we don't want to compare them.
      if (updatedException.path_and_schedule) {
        const originalPacedTrainPathSteps = updatedTrain.path.map((_, i) =>
          computeBasePathStep(updatedTrain, i)
        );
        const exceptionPathSteps = updatedException.path_and_schedule.path.map((_, i) =>
          computeBasePathStep(updatedException.path_and_schedule!, i)
        );
        if (
          originalPacedTrainPathSteps.length === exceptionPathSteps.length &&
          originalPacedTrainPathSteps.every((pathStep, i) =>
            isEqual(omit(pathStep, 'id'), omit(exceptionPathSteps[i], 'id'))
          )
        ) {
          delete updatedException.path_and_schedule;
        }
      }

      if (
        exception.rolling_stock &&
        isEqual(exception.rolling_stock.comfort, updatedTrain.comfort) &&
        isEqual(exception.rolling_stock.rolling_stock_name, updatedTrain.rolling_stock_name)
      ) {
        delete updatedException.rolling_stock;
      }

      if (
        exception.rolling_stock_category &&
        isEqual(exception.rolling_stock_category.value, updatedTrain.category)
      ) {
        delete updatedException.rolling_stock_category;
      }

      if (
        exception.speed_limit_tag &&
        isEqual(
          exception.speed_limit_tag.value ?? null,
          // speed limit tag is instantiated with null if not present when formatting the item
          updatedTrain.speed_limit_tag ?? null
        )
      ) {
        delete updatedException.speed_limit_tag;
      }

      // We do the check only for indexed occurrences because added exceptions should not have
      // their start time reset
      if (exception.start_time && exception.occurrence_index !== undefined) {
        const originalPacedTrainInterval = Duration.parse(paced.interval);
        const originalStartTimeToTest = computeIndexedOccurrenceStartTime(
          new Date(updatedTrain.start_time),
          originalPacedTrainInterval,
          exception.occurrence_index
        );
        const exceptionStartTime = new Date(exception.start_time.value);

        // Remove milliseconds to avoid issues with the comparison
        originalStartTimeToTest.setMilliseconds(0);
        exceptionStartTime.setMilliseconds(0);
        if (isEqual(originalStartTimeToTest, exceptionStartTime)) {
          delete updatedException.start_time;
        }
      }

      // We do the check only for indexed occurrences because added exceptions names won't match
      // a cadenced name format
      if (exception.train_name && exception.occurrence_index !== undefined) {
        // Compute the name that the occurrence at this index should have with the new name
        const occurrenceFormattedName = computeOccurrenceName(
          updatedTrain.train_name,
          exception.occurrence_index
        );
        if (isEqual(exception.train_name.value, occurrenceFormattedName)) {
          delete updatedException.train_name;
        }
      }

      // If the exception is now empty, we don't want to keep it anymore in the list
      // We check explicitly for change group keys to avoid false positives from
      // metadata fields like 'id', 'disabled', 'summary', etc.
      const hasChangedGroup = CHANGE_GROUP_KEYS.some((key) => key in updatedException);

      if (hasChangedGroup) {
        acc.exceptions.push(updatedException);
        if (!isEqual(updatedException, exception)) {
          acc.modifiedExceptions.push(updatedException);
        }
      } else {
        // All change groups were cleaned: the exception should be dropped.
        // TODO_EXCEPTION: remove the "!" when using TrainScheduleException type
        acc.exceptionsToDeleteIds.push(exception.id!);
      }

      return acc;
    },
    { exceptions: [], modifiedExceptions: [], exceptionsToDeleteIds: [] }
  );
}
