import type {
  TimetableItemWithDetails,
  PacedTrainWithDetails,
  Occurrence,
} from 'modules/trainschedule/components/Timetable/types';
import type {
  AddedExceptionId,
  IndexedOccurrenceId,
  OccurrenceId,
  PacedTrainId,
  PacedTrainResponseWithPacedTrainId,
  TimetableItemWithTimetableId,
  TrainId,
  TrainScheduleId,
} from 'reducers/osrdconf/types';

export const isPacedTrain = (id: string): id is PacedTrainId => id.startsWith('paced_');

const isIndexedOccurrence = (id: string): id is IndexedOccurrenceId =>
  id.startsWith('indexedoccurrence_');

const isAddedException = (id: string): id is AddedExceptionId => id.startsWith('exception_');

export const isOccurrence = (id: string): id is OccurrenceId =>
  isIndexedOccurrence(id) || isAddedException(id);

export const isTrainSchedule = (id: string): id is TrainScheduleId =>
  id.startsWith('trainschedule_');

export const isTrainId = (id: string): id is TrainId => isOccurrence(id) || isTrainSchedule(id);

/**
 * Given an occurrence id, return the type of the exception.
 * - An added exception is an occurrence created at the same time of a paced train creation/edition
 * and will always be desynchronised with the paced train interval/time window.
 * - An added exception that has been modified is still considered as an added exception.
 */
export const getExceptionType = (occurrence: Occurrence): 'added' | 'modified' | null => {
  const { id, exceptionChangeGroups } = occurrence;
  if (isAddedException(id)) {
    return 'added';
  }
  if (isIndexedOccurrence(id) && exceptionChangeGroups && exceptionChangeGroups.length > 0) {
    return 'modified';
  }
  return null;
};

export const isPacedTrainResponseWithPacedTrainId = (
  timetableItem: TimetableItemWithTimetableId
): timetableItem is PacedTrainResponseWithPacedTrainId => isPacedTrain(timetableItem.id);

export const isPacedTrainWithDetails = (
  timetableItem: TimetableItemWithDetails
): timetableItem is PacedTrainWithDetails => isPacedTrain(timetableItem.id);

/**
 * Given a train id in the Editoast format (used for api),
 * returns the train id with a TrainScheduleId format (used across the front).
 */
export const formatEditoastTrainIdToTrainScheduleId = (trainId: number): TrainScheduleId =>
  `trainschedule_${trainId}` as TrainScheduleId;

/**
 * Given a train id in the Editoast format (used for api),
 * returns the paced train id with a PacedTrainId format (used across the front).
 */
export const formatEditoastTrainIdToPacedTrainId = (trainId: number): PacedTrainId =>
  `paced_${trainId}` as PacedTrainId;

/**
 * Given a paced train id in the Editoast format (used for api),
 * returns the occurrence id with an IndexedOccurrenceId format (used across the front).
 */
export const formatEditoastTrainIdToIndexedOccurrenceId = ({
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
export const formatEditoastTrainIdToExceptionId = ({
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
export const formatTrainScheduleIdToEditoastTrainId = (trainId: TrainScheduleId): number => {
  if (!isTrainSchedule(trainId)) {
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
export const formatPacedTrainIdToEditoastTrainId = (pacedTrainId: PacedTrainId): number => {
  if (!isPacedTrain(pacedTrainId)) {
    throw new Error('The paced train id should start with "paced_"');
  }
  const formattedPacedTrainId = Number(pacedTrainId.split('_')[1]);

  if (Number.isNaN(formattedPacedTrainId)) {
    throw new Error(`Invalid paced train ID: ${pacedTrainId}`);
  }

  return formattedPacedTrainId;
};

/**
 * Given a occurrence id with an OccurrenceId format (used across the front),
 * returns the paced train id in the Editoast format (used for api).
 */
export const formatOccurrenceIdToEditoastTrainId = (occurrenceId: OccurrenceId): number => {
  if (!isOccurrence(occurrenceId)) {
    throw new Error(
      'The occurrence id should match the format "indexedoccurrence_{pacedTrainId}_{occurrenceIndex}" or "exception_{pacedTrainId}_{exceptionId}"'
    );
  }

  const formattedPacedTrainId = Number(occurrenceId.split('_')[1]);

  if (Number.isNaN(formattedPacedTrainId)) {
    throw new Error(`Invalid paced train ID : ${occurrenceId}`);
  }

  return formattedPacedTrainId;
};

/**
 * Given a paced train id with a PacedTrainId format (used across the front),
 * returns the occurrence id with an OccurrenceId format (used across the front).
 */
export const formatPacedTrainIdToOccurrenceId = (
  pacedTrainId: PacedTrainId,
  occurrenceIndex: number
): IndexedOccurrenceId => {
  const editoastTrainId = formatPacedTrainIdToEditoastTrainId(pacedTrainId);
  return formatEditoastTrainIdToIndexedOccurrenceId({
    pacedTrainId: editoastTrainId,
    occurrenceIndex,
  });
};

/**
 * Given a occurrence id with an OccurrenceId format (used across the front),
 * extract its paced train id with a PacedTrainId format (used across the front).
 */
export const extractPacedTrainIdFromOccurrenceId = (occurrenceId: OccurrenceId): PacedTrainId => {
  const editoastTrainId = formatOccurrenceIdToEditoastTrainId(occurrenceId);
  return formatEditoastTrainIdToPacedTrainId(editoastTrainId);
};

/**
 * Given a occurrence id with an OccurrenceId format (used across the front),
 * returns the occurrence index.
 */
export const getOccurrenceIndexFromOccurrenceId = (occurrenceId: OccurrenceId): number => {
  if (!isIndexedOccurrence(occurrenceId)) {
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
export const getExceptionIdFromOccurrenceId = (occurrenceId: OccurrenceId): string => {
  if (!isAddedException(occurrenceId)) {
    throw new Error(
      'The occurrence id should match the format "exception_{pacedTrainId}_{exceptionId}"'
    );
  }

  const [_type, _pacedTrainId, ...exceptionId] = occurrenceId.split('_');

  // Handle the case where exceptionId contains "_" itself
  return exceptionId.join('_');
};
