import type {
  OccurrenceId,
  PacedTrainId,
  PacedTrainResponseWithPacedTrainId,
  TimetableItemWithTimetableId,
  TrainScheduleId,
} from 'reducers/osrdconf/types';

export const isPacedTrain = (id: string): id is PacedTrainId => id.startsWith('paced-');

export const isOccurrence = (id: string): id is OccurrenceId => {
  const occurrenceSyntax = id.split('-')[0];
  const pacedSyntax = id.split('-')[2];
  return occurrenceSyntax === 'occurrence' && pacedSyntax === 'paced';
};

export const isTrainSchedule = (id: string): id is TrainScheduleId =>
  id.startsWith('trainschedule-');

export const isPacedTrainResponseWithPacedTrainId = (
  timetableItem: TimetableItemWithTimetableId
): timetableItem is PacedTrainResponseWithPacedTrainId => isPacedTrain(timetableItem.id);

/**
 * Given a train id in the Editoast format (used for api),
 * returns the train id with a TrainScheduleId format (used across the front).
 */
export const formatEditoastTrainIdToTrainScheduleId = (trainId: number): TrainScheduleId =>
  `trainschedule-${trainId}` as TrainScheduleId;

/**
 * Given a train id in the Editoast format (used for api),
 * returns the paced train id with a PacedTrainId format (used across the front).
 */
export const formatEditoastTrainIdToPacedTrainId = (trainId: number): PacedTrainId =>
  `paced-${trainId}` as PacedTrainId;

/**
 * Given a paced train id in the Editoast format (used for api),
 * returns the occurrence id with a OccurrenceId format (used across the front).
 */
export const formatEditoastTrainIdToOccurrenceId = ({
  pacedTrainId,
  occurrenceIndex,
}: {
  pacedTrainId: number;
  occurrenceIndex: number;
}): OccurrenceId => `occurrence-${occurrenceIndex}-paced-${pacedTrainId}` as OccurrenceId;

/**
 * Given a train id with a TrainScheduleId format (used across the front),
 * returns the train id in the Editoast format (used for api).
 */
export const formatTrainScheduleIdToEditoastTrainId = (trainId: TrainScheduleId): number => {
  if (!isTrainSchedule(trainId)) {
    throw new Error('The train schedule id should start with "trainschedule-"');
  }
  const formattedTrainId = Number(trainId.split('-')[1]);

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
    throw new Error('The paced train id should start with "paced-"');
  }
  const formattedTrainId = Number(pacedTrainId.split('-')[1]);

  if (Number.isNaN(formattedTrainId)) {
    throw new Error(`Invalid paced train ID: ${pacedTrainId}`);
  }

  return formattedTrainId;
};

/**
 * Given a occurrence id with an OccurrenceId format (used across the front),
 * returns the paced train id in the Editoast format (used for api).
 */
export const formatOccurrenceIdToEditoastTrainId = (occurrenceId: OccurrenceId): number => {
  if (!isOccurrence(occurrenceId)) {
    throw new Error(
      'The occurrence id should match the format "occurrence-{occurrenceIndex}-paced-{trainId}"'
    );
  }

  const formattedOccurrenceIndex = Number(occurrenceId.split('-')[1]);
  const formattedTrainId = Number(occurrenceId.split('-')[3]);

  if (Number.isNaN(formattedOccurrenceIndex) || Number.isNaN(formattedTrainId)) {
    throw new Error(`Invalid paced train ID or occurrence index: ${occurrenceId}`);
  }

  return formattedTrainId;
};

/**
 * Given a occurrence id with an OccurrenceId format (used across the front),
 * returns the occurrence index.
 */
export const getOccurrenceIndexFromOccurrenceId = (occurrenceId: OccurrenceId): number => {
  if (!isOccurrence(occurrenceId)) {
    throw new Error(
      'The occurrence id should match the format "occurrence-{occurrenceIndex}-paced-{trainId}"'
    );
  }

  const formattedOccurrenceIndex = Number(occurrenceId.split('-')[1]);

  if (Number.isNaN(formattedOccurrenceIndex)) {
    throw new Error(`Invalid paced train ID or occurrence index: ${occurrenceId}`);
  }

  return formattedOccurrenceIndex;
};
