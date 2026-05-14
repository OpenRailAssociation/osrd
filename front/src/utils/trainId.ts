import { isEmpty } from 'lodash';

import type { PacedTrainException } from 'common/api/osrdEditoastApi';
import { isOccurrencePresentInPacedTrain } from 'modules/trainSchedule/helpers/pacedTrain';
import type { Occurrence, TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type {
  AddedExceptionId,
  IndexedOccurrenceId,
  OccurrenceId,
  TrainScheduleId,
  TrainId,
} from 'reducers/osrdconf/types';

export const isTrainScheduleId = (id: string): id is TrainScheduleId =>
  id.startsWith('trainSchedule_');

export const isIndexedOccurrenceId = (id: string): id is IndexedOccurrenceId =>
  id.startsWith('indexedoccurrence_');

export const isAddedExceptionId = (id: string): id is AddedExceptionId =>
  id.startsWith('exception_');

export const isOccurrenceId = (id: string): id is OccurrenceId =>
  isIndexedOccurrenceId(id) || isAddedExceptionId(id);

export const isTrainId = (id: string): id is TrainId => isOccurrenceId(id) || isTrainScheduleId(id);

/**
 * Given an occurrence id, return the type of the exception.
 * - An added exception is an occurrence created at the same time of a paced train creation/edition
 * and will always be desynchronised with the paced train interval/time window.
 * - An added exception that has been modified is still considered as an added exception.
 */
export const getExceptionType = (occurrence: Occurrence): 'added' | 'modified' | null => {
  const { id, exception } = occurrence;
  const exceptionChangeGroups = exception && exception.exceptionChangeGroups;
  if (isAddedExceptionId(id)) {
    return 'added';
  }
  if (isIndexedOccurrenceId(id) && !isEmpty(exceptionChangeGroups)) {
    return 'modified';
  }
  return null;
};

export const isException = (occurrence: Occurrence) => !!getExceptionType(occurrence);

/**
 * Checks if an exception is related to the path or simulation.
 */
export const isExceptionFromPathOrSimulation = ({ exception }: Occurrence) => {
  const exceptionChangeGroups = exception?.exceptionChangeGroups;
  return (
    exceptionChangeGroups &&
    (exceptionChangeGroups.path_and_schedule ||
      exceptionChangeGroups.options ||
      exceptionChangeGroups.constraint_distribution ||
      exceptionChangeGroups.speed_limit_tag ||
      exceptionChangeGroups.initial_speed ||
      exceptionChangeGroups.rolling_stock)
  );
};

/**
 * Given a train id in the Editoast format (used for api),
 * returns the train schedule id with a TrainScheduleId format (used across the front).
 */
export const formatEditoastIdToTrainScheduleId = (trainId: number): TrainScheduleId =>
  `trainSchedule_${trainId}` as TrainScheduleId;

/**
 * Given a train schedule id in the Editoast format (used for api),
 * returns the occurrence id with an IndexedOccurrenceId format (used across the front).
 */
export const formatEditoastIdToIndexedOccurrenceId = ({
  trainScheduleId,
  occurrenceIndex,
}: {
  trainScheduleId: number;
  occurrenceIndex: number;
}): IndexedOccurrenceId =>
  `indexedoccurrence_${trainScheduleId}_${occurrenceIndex}` as IndexedOccurrenceId;

/**
 * Given a train schedule id in the Editoast format (used for api) and an exception id,
 * returns the added exception id with an AddedExceptionId format (used across the front).
 */
export const formatEditoastIdToExceptionId = ({
  trainScheduleId,
  exceptionId,
}: {
  trainScheduleId: number;
  exceptionId: number;
}): AddedExceptionId => `exception_${trainScheduleId}_${exceptionId}` as AddedExceptionId;

/**
 * Given a train schedule id with a TrainScheduleId format (used across the front),
 * returns the train id in the Editoast format (used for api).
 */
export const extractEditoastIdFromTrainScheduleId = (trainScheduleId: TrainScheduleId): number => {
  if (!isTrainScheduleId(trainScheduleId)) {
    throw new Error('The train schedule id should start with "trainSchedule_"');
  }
  const formattedTrainScheduleId = Number(trainScheduleId.split('_')[1]);

  if (Number.isNaN(formattedTrainScheduleId)) {
    throw new Error(`Invalid train schedule ID: ${trainScheduleId}`);
  }

  return formattedTrainScheduleId;
};

/**
 * Given a train schedule id with a TrainScheduleId format (used across the front),
 * returns the occurrence id with an OccurrenceId format (used across the front).
 */
export const formatTrainScheduleIdToIndexedOccurrenceId = (
  trainScheduleId: TrainScheduleId,
  occurrenceIndex: number
): IndexedOccurrenceId => {
  const editoastTrainId = extractEditoastIdFromTrainScheduleId(trainScheduleId);
  return formatEditoastIdToIndexedOccurrenceId({
    trainScheduleId: editoastTrainId,
    occurrenceIndex,
  });
};

/**
 * Given a train schedule id with a TrainScheduleId format (used across the front),
 * returns the exception id with an ExceptionId format (used across the front).
 */
export const formatTrainScheduleIdToExceptionId = (
  trainScheduleId: TrainScheduleId,
  exceptionId: number
): AddedExceptionId => {
  const editoastTrainId = extractEditoastIdFromTrainScheduleId(trainScheduleId);
  return formatEditoastIdToExceptionId({
    trainScheduleId: editoastTrainId,
    exceptionId,
  });
};

/**
 * Given a train schedule id with a TrainScheduleId format (used across the front),
 * returns the occurrence id with an OccurrenceId format (used across the front).
 */
export const formatTrainScheduleIdToOccurrenceId = (
  trainScheduleId: TrainScheduleId,
  exception: PacedTrainException
): OccurrenceId =>
  exception.occurrence_index
    ? formatTrainScheduleIdToIndexedOccurrenceId(trainScheduleId, exception.occurrence_index)
    : // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
      formatTrainScheduleIdToExceptionId(trainScheduleId, Number(exception.id!));

/**
 * Given a occurrence id with an OccurrenceId format (used across the front),
 * extract its train schedule id with a TrainScheduleId format (used across the front).
 */
export const extractTrainScheduleIdFromOccurrenceId = (
  occurrenceId: OccurrenceId
): TrainScheduleId => {
  if (!isOccurrenceId(occurrenceId)) {
    throw new Error(
      'The occurrence id should match the format "indexedoccurrence_{trainScheduleId}_{occurrenceIndex}" or "exception_{trainScheduleId}_{exceptionId}"'
    );
  }

  const trainScheduleId = Number(occurrenceId.split('_')[1]);
  if (Number.isNaN(trainScheduleId)) {
    throw new Error(`Invalid train schedule ID : ${occurrenceId}`);
  }

  return formatEditoastIdToTrainScheduleId(trainScheduleId);
};

/**
 * Given a train id (paced or occurrence), returns the train schedule id it
 * belongs to. A train schedule id is returned as-is.
 */
export const extractTrainScheduleIdFromTrainId = (trainId: TrainId): TrainScheduleId =>
  isOccurrenceId(trainId) ? extractTrainScheduleIdFromOccurrenceId(trainId) : trainId;

/**
 * Given a occurrence id with an OccurrenceId format (used across the front),
 * returns the occurrence index.
 */
export const extractOccurrenceIndexFromOccurrenceId = (occurrenceId: OccurrenceId): number => {
  if (!isIndexedOccurrenceId(occurrenceId)) {
    throw new Error(
      'The occurrence id should match the format "indexedoccurrence_{trainScheduleId}_{occurrenceIndex}"'
    );
  }

  const formattedOccurrenceIndex = Number(occurrenceId.split('_')[2]);

  if (Number.isNaN(formattedOccurrenceIndex)) {
    throw new Error(`Invalid occurrence index: ${occurrenceId}`);
  }

  return formattedOccurrenceIndex;
};

/**
 * Given a occurrence id with an OccurrenceId format (used across the front),
 * returns the exception id.
 */
export const extractExceptionIdFromOccurrenceId = (occurrenceId: OccurrenceId): number => {
  if (!isAddedExceptionId(occurrenceId)) {
    throw new Error(
      'The occurrence id should match the format "exception_{trainScheduleId}_{exceptionId}"'
    );
  }

  const [_type, _trainScheduleId, ...exceptionId] = occurrenceId.split('_');

  const result = Number(exceptionId.join('_'));
  if (Number.isNaN(result)) {
    throw new Error(`Exception ID should be a number: ${occurrenceId}`);
  }

  // Handle the case where exceptionId contains "_" itself
  return result;
};

export const isTrainIdInTimetable = (
  trainId: TrainId | undefined,
  trainSchedules: Pick<TrainScheduleWithDetails, 'id' | 'paced'>[]
): boolean => {
  if (!trainId) return false;

  const trainScheduleId = isOccurrenceId(trainId)
    ? extractTrainScheduleIdFromOccurrenceId(trainId)
    : trainId;
  const trainScheduleEditoastId = extractEditoastIdFromTrainScheduleId(trainScheduleId);

  const trainSchedule = trainSchedules.find((train) => train.id === trainScheduleEditoastId);
  if (!trainSchedule) return false;

  if (!isOccurrenceId(trainId)) return true;
  return isOccurrencePresentInPacedTrain(trainId, trainSchedule);
};

/**
 * Given a train ID (either an occurrence or a paced/unique train), get the editoast ID,
 * returns the train id in the Editoast format (used for api).
 * @param trainId
 * @returns
 */
export function extractEditoastIdFromTrainId(trainId: TrainId): number {
  return extractEditoastIdFromTrainScheduleId(
    isOccurrenceId(trainId) ? extractTrainScheduleIdFromOccurrenceId(trainId) : trainId
  );
}
