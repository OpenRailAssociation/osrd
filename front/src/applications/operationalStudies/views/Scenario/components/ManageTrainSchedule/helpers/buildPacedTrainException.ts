import { isEqual, isUndefined, omit, omitBy } from 'lodash';

import type { PacedTrain } from 'applications/operationalStudies/types';
import type { TrainSchedule, PacedTrainException } from 'common/api/osrdEditoastApi';
import computeBasePathStep from 'modules/trainSchedule/helpers/computeBasePathStep';
import computeOccurrenceName from 'modules/trainSchedule/helpers/computeOccurrenceName';
import {
  CHANGE_GROUP_KEYS,
  findExceptionWithOccurrenceId,
  computeIndexedOccurrenceStartTime,
  hasExceptions,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import { removeElementAtIndex, replaceElementAtIndex } from 'utils/array';
import { Duration } from 'utils/duration';
import {
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  isIndexedOccurrenceId,
} from 'utils/trainId';

/**
 * Normalizes the optional/nullable fields of a train so that "absent" and its
 * semantic default value compare as equal, instead of tripping isEqual into
 * reporting a phantom difference (e.g. options: undefined vs options: {}).
 */
function normalizeTrainForDiff(train: Omit<TrainSchedule, 'paced'>) {
  return {
    ...train,
    category: train.category ?? null,
    comfort: train.comfort ?? 'STANDARD',
    initial_speed: train.initial_speed ?? 0,
    labels: train.labels ?? [],
    options: omitBy(train.options ?? {}, isUndefined),
    power_restrictions: train.power_restrictions ?? [],
    speed_limit_tag: train.speed_limit_tag ?? null,
  };
}

/**
 * Compare the original paced train with the one from the occurrence update and
 * fill the original paced train exceptions property every time a field is different
 * the caller is responsible for generating the exception key and occurrence index.
 */
export function generatePacedTrainException(
  updatedOccurrence: Omit<TrainSchedule, 'paced'>,
  originalPacedTrain: Omit<PacedTrain, 'train_schedule_set_id'>,
  occurrenceIndex: number | null = null
  // TODO_EXCEPTION: remove `key`
): Omit<PacedTrainException, 'key' | 'occurrence_index'> {
  const exception: Omit<PacedTrainException, 'key' | 'occurrence_index'> = {};

  const original = normalizeTrainForDiff(originalPacedTrain);
  const updated = normalizeTrainForDiff(updatedOccurrence);

  if (!isEqual(original.constraint_distribution, updated.constraint_distribution)) {
    exception.constraint_distribution = {
      value: updatedOccurrence.constraint_distribution,
    };
  }

  if (!isEqual(original.initial_speed, updated.initial_speed)) {
    exception.initial_speed = { value: updated.initial_speed };
  }

  if (!isEqual(original.labels, updated.labels)) {
    exception.labels = { value: updated.labels };
  }

  if (!isEqual(original.options, updated.options)) {
    exception.options = { value: updated.options };
  }

  // Compute first all path steps of both paced trains to compare to facilitate the comparison
  // As the front generates each path step id, between two same pathfinding, ids could be different
  // so we don't want to compare them.
  const originalPacedTrainPathSteps = original.path.map((_, i) => computeBasePathStep(original, i));
  const pacedTrainWithOccurrenceChangesPathSteps = updated.path.map((_, i) =>
    computeBasePathStep(updated, i)
  );

  if (
    originalPacedTrainPathSteps.length !== pacedTrainWithOccurrenceChangesPathSteps.length ||
    originalPacedTrainPathSteps.some(
      (pathStep, i) =>
        !isEqual(omit(pathStep, 'id'), omit(pacedTrainWithOccurrenceChangesPathSteps[i], 'id'))
    ) ||
    !isEqual(original.power_restrictions, updated.power_restrictions)
  ) {
    exception.path_and_schedule = {
      margins: updated.margins ?? { boundaries: [], values: ['0%'] },
      path: updated.path,
      power_restrictions: updated.power_restrictions,
      schedule: updated.schedule ?? [],
    };
  }

  if (
    originalPacedTrain.rolling_stock_name !== updatedOccurrence.rolling_stock_name ||
    !isEqual(original.comfort, updated.comfort)
  ) {
    exception.rolling_stock = {
      rolling_stock_name: updatedOccurrence.rolling_stock_name,
      comfort: updated.comfort,
    };
  }

  if (!isEqual(original.category, updated.category)) {
    exception.rolling_stock_category = { value: updatedOccurrence.category };
  }

  if (!isEqual(original.speed_limit_tag, updated.speed_limit_tag)) {
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
 * Computes the exception diff data needed to create/update/delete an exception
 * for a given occurrence update. Pure function — caller handles the API calls.
 */
export function buildOccurrenceExceptionData(
  originalPacedTrain: Omit<PacedTrain, 'train_schedule_set_id'>,
  updatedOccurrence: TrainSchedule,
  occurrenceId: OccurrenceId
): {
  generatedException: Omit<PacedTrainException, 'key' | 'occurrence_index'>;
  existingException: PacedTrainException | undefined;
  occurrenceIndex: number | undefined;
} {
  const occurrenceIndex = isIndexedOccurrenceId(occurrenceId)
    ? extractOccurrenceIndexFromOccurrenceId(occurrenceId)
    : undefined;

  return {
    generatedException: generatePacedTrainException(
      updatedOccurrence,
      originalPacedTrain,
      occurrenceIndex ?? null
    ),
    existingException: findExceptionWithOccurrenceId(
      originalPacedTrain.paced.exceptions,
      occurrenceId
    ),
    occurrenceIndex,
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
  const normalizedUpdatedTrain = normalizeTrainForDiff(updatedTrain);

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
        isEqual(exception.initial_speed.value, normalizedUpdatedTrain.initial_speed)
      ) {
        delete updatedException.initial_speed;
      }

      if (exception.labels && isEqual(exception.labels.value, normalizedUpdatedTrain.labels)) {
        delete updatedException.labels;
      }

      if (
        exception.options &&
        isEqual(omitBy(exception.options.value, isUndefined), normalizedUpdatedTrain.options)
      ) {
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
          ) &&
          isEqual(
            updatedException.path_and_schedule.power_restrictions ?? [],
            normalizedUpdatedTrain.power_restrictions
          )
        ) {
          delete updatedException.path_and_schedule;
        }
      }

      if (
        exception.rolling_stock &&
        isEqual(exception.rolling_stock.comfort, normalizedUpdatedTrain.comfort) &&
        isEqual(exception.rolling_stock.rolling_stock_name, updatedTrain.rolling_stock_name)
      ) {
        delete updatedException.rolling_stock;
      }

      if (
        exception.rolling_stock_category &&
        isEqual(exception.rolling_stock_category.value ?? null, normalizedUpdatedTrain.category)
      ) {
        delete updatedException.rolling_stock_category;
      }

      if (
        exception.speed_limit_tag &&
        isEqual(exception.speed_limit_tag.value ?? null, normalizedUpdatedTrain.speed_limit_tag)
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
      // metadata fields like 'id', 'summary', etc.
      const hasChangedGroup = CHANGE_GROUP_KEYS.some((key) => key in updatedException);

      if (hasChangedGroup || updatedException.disabled) {
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
