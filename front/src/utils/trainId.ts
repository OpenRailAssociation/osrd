import { isEmpty } from 'lodash';

import type { PacedTrainException } from 'common/api/osrdEditoastApi';
import type {
  TimetableItemWithDetails,
  PacedTrainWithDetails,
  Occurrence,
} from 'modules/timetableItem/types';
import type {
  AddedExceptionId,
  IndexedOccurrenceId,
  OccurrenceId,
  PacedTrainId,
  PacedTrainWithPacedTrainId,
  TimetableItem,
  TrainId,
  TrainScheduleId,
} from 'reducers/osrdconf/types';

export const isPacedTrainId = (id: string): id is PacedTrainId => id.startsWith('paced_');

export const isIndexedOccurrenceId = (id: string): id is IndexedOccurrenceId =>
  id.startsWith('indexedoccurrence_');

export const isAddedExceptionId = (id: string): id is AddedExceptionId =>
  id.startsWith('exception_');

export const isOccurrenceId = (id: string): id is OccurrenceId =>
  isIndexedOccurrenceId(id) || isAddedExceptionId(id);

export const isTrainScheduleId = (id: string): id is TrainScheduleId =>
  id.startsWith('trainschedule_');

export const isTrainId = (id: string): id is TrainId => isOccurrenceId(id) || isTrainScheduleId(id);

/**
 * Given an occurrence id, return the type of the exception.
 * - An added exception is an occurrence created at the same time of a paced train creation/edition
 * and will always be desynchronised with the paced train interval/time window.
 * - An added exception that has been modified is still considered as an added exception.
 */
export const getExceptionType = (occurrence: Occurrence): 'added' | 'modified' | null => {
  const { id, exceptionChangeGroups } = occurrence;
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
export const isExceptionFromPathOrSimulation = ({ exceptionChangeGroups }: Occurrence) =>
  exceptionChangeGroups &&
  (exceptionChangeGroups.path_and_schedule ||
    exceptionChangeGroups.options ||
    exceptionChangeGroups.constraint_distribution ||
    exceptionChangeGroups.speed_limit_tag ||
    exceptionChangeGroups.initial_speed ||
    exceptionChangeGroups.rolling_stock);

export const isPacedTrainResponseWithPacedTrainId = (
  timetableItem: TimetableItem
): timetableItem is PacedTrainWithPacedTrainId => isPacedTrainId(timetableItem.id);

export const isPacedTrainWithDetails = (
  timetableItem: TimetableItemWithDetails
): timetableItem is PacedTrainWithDetails => isPacedTrainId(timetableItem.id);

/**
 * Given a train id in the Editoast format (used for api),
 * returns the train id with a TrainScheduleId format (used across the front).
 */
export const formatEditoastIdToTrainScheduleId = (trainId: number): TrainScheduleId =>
  `trainschedule_${trainId}` as TrainScheduleId;

/**
 * Given a train id in the Editoast format (used for api),
 * returns the paced train id with a PacedTrainId format (used across the front).
 */
export const formatEditoastIdToPacedTrainId = (trainId: number): PacedTrainId =>
  `paced_${trainId}` as PacedTrainId;

/**
 * Given a paced train id in the Editoast format (used for api),
 * returns the occurrence id with an IndexedOccurrenceId format (used across the front).
 */
export const formatEditoastIdToIndexedOccurrenceId = ({
  pacedTrainId,
  occurrenceIndex,
}: {
  pacedTrainId: number;
  occurrenceIndex: number;
}): IndexedOccurrenceId =>
  `indexedoccurrence_${pacedTrainId}_${occurrenceIndex}` as IndexedOccurrenceId;

/**
 * Given a paced train id in the Editoast format (used for api) and an exception id,
 * returns the added exception id with an AddedExceptionId format (used across the front).
 */
export const formatEditoastIdToExceptionId = ({
  pacedTrainId,
  exceptionId,
}: {
  pacedTrainId: number;
  exceptionId: string;
}): AddedExceptionId => `exception_${pacedTrainId}_${exceptionId}` as AddedExceptionId;

/**
 * Given a train id with a TrainScheduleId format (used across the front),
 * returns the train id in the Editoast format (used for api).
 */
export const extractEditoastIdFromTrainScheduleId = (trainId: TrainScheduleId): number => {
  if (!isTrainScheduleId(trainId)) {
    throw new Error('The train schedule id should start with "trainschedule_"');
  }
  const formattedTrainId = Number(trainId.split('_')[1]);

  if (Number.isNaN(formattedTrainId)) {
    throw new Error(`Invalid train ID: ${trainId}`);
  }

  return formattedTrainId;
};

/**
 * Given a paced train id with a PacedTrainId format (used across the front),
 * returns the train id in the Editoast format (used for api).
 */
export const extractEditoastIdFromPacedTrainId = (pacedTrainId: PacedTrainId): number => {
  if (!isPacedTrainId(pacedTrainId)) {
    throw new Error('The paced train id should start with "paced_"');
  }
  const formattedPacedTrainId = Number(pacedTrainId.split('_')[1]);

  if (Number.isNaN(formattedPacedTrainId)) {
    throw new Error(`Invalid paced train ID: ${pacedTrainId}`);
  }

  return formattedPacedTrainId;
};

/**
 * Given a paced train id with a PacedTrainId format (used across the front),
 * returns the occurrence id with an OccurrenceId format (used across the front).
 */
export const formatPacedTrainIdToIndexedOccurrenceId = (
  pacedTrainId: PacedTrainId,
  occurrenceIndex: number
): IndexedOccurrenceId => {
  const editoastTrainId = extractEditoastIdFromPacedTrainId(pacedTrainId);
  return formatEditoastIdToIndexedOccurrenceId({
    pacedTrainId: editoastTrainId,
    occurrenceIndex,
  });
};

/**
 * Given a paced train id with a PacedTrainId format (used across the front),
 * returns the exception id with an ExceptionId format (used across the front).
 */
export const formatPacedTrainIdToExceptionId = (
  pacedTrainId: PacedTrainId,
  exceptionId: string
): AddedExceptionId => {
  const editoastTrainId = extractEditoastIdFromPacedTrainId(pacedTrainId);
  return formatEditoastIdToExceptionId({
    pacedTrainId: editoastTrainId,
    exceptionId,
  });
};

/**
 * Given a paced train id with a PacedTrainId format (used across the front),
 * returns the occurrence id with an OccurrenceId format (used across the front).
 */
export const formatPacedTrainIdToOccurrenceId = (
  pacedTrainId: PacedTrainId,
  exception: PacedTrainException
): OccurrenceId =>
  exception.occurrence_index
    ? formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, exception.occurrence_index)
    : formatPacedTrainIdToExceptionId(pacedTrainId, exception.key);

/**
 * Given a occurrence id with an OccurrenceId format (used across the front),
 * extract its paced train id with a PacedTrainId format (used across the front).
 */
export const extractPacedTrainIdFromOccurrenceId = (occurrenceId: OccurrenceId): PacedTrainId => {
  if (!isOccurrenceId(occurrenceId)) {
    throw new Error(
      'The occurrence id should match the format "indexedoccurrence_{pacedTrainId}_{occurrenceIndex}" or "exception_{pacedTrainId}_{exceptionId}"'
    );
  }

  const editoastPacedTrainId = Number(occurrenceId.split('_')[1]);
  if (Number.isNaN(editoastPacedTrainId)) {
    throw new Error(`Invalid paced train ID : ${occurrenceId}`);
  }

  return formatEditoastIdToPacedTrainId(editoastPacedTrainId);
};

/**
 * Given a train id with a TrainId format (either TrainScheduleId or OccurrenceId),
 * returns the Editoast id (used for api).
 */
export const extractEditoastIdFromTrainId = (id: TrainId): number =>
  isTrainScheduleId(id)
    ? extractEditoastIdFromTrainScheduleId(id)
    : extractEditoastIdFromPacedTrainId(extractPacedTrainIdFromOccurrenceId(id));

/**
 * Given a occurrence id with an OccurrenceId format (used across the front),
 * returns the occurrence index.
 */
export const extractOccurrenceIndexFromOccurrenceId = (occurrenceId: OccurrenceId): number => {
  if (!isIndexedOccurrenceId(occurrenceId)) {
    throw new Error(
      'The occurrence id should match the format "indexedoccurrence_{pacedTrainId}_{occurrenceIndex}"'
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
export const extractExceptionIdFromOccurrenceId = (occurrenceId: OccurrenceId): string => {
  if (!isAddedExceptionId(occurrenceId)) {
    throw new Error(
      'The occurrence id should match the format "exception_{pacedTrainId}_{exceptionId}"'
    );
  }

  const [_type, _pacedTrainId, ...exceptionId] = occurrenceId.split('_');

  // Handle the case where exceptionId contains "_" itself
  return exceptionId.join('_');
};
