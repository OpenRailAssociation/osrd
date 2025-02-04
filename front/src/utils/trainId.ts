import type { OccurrenceId, PacedTrainId, TrainScheduleId } from 'reducers/osrdconf/types';

export const isPacedTrain = (id: TrainScheduleId | PacedTrainId): id is PacedTrainId =>
  id.startsWith('paced-');

export const isOccurrence = (id: TrainScheduleId | OccurrenceId): id is OccurrenceId => {
  const pacedSyntax = id.split('-')[0];
  const occurrenceSyntax = id.split('-')[2];
  return pacedSyntax === 'paced' && occurrenceSyntax === 'occurrence';
};

export const isTrainSchedule = (
  id: TrainScheduleId | OccurrenceId | PacedTrainId
): id is TrainScheduleId => id.startsWith('train-');

/**
 * Given a train id in the Editoast format (used for api),
 * returns the train id with a TrainScheduleId format (used across the front).
 */
export const formatEditoastTrainIdToTrainScheduleId = (trainId: number): TrainScheduleId =>
  `train-${trainId}` as TrainScheduleId;

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
}): OccurrenceId => `paced-${pacedTrainId}-occurrence-${occurrenceIndex}` as OccurrenceId;

/**
 * Given a train id with a TrainScheduleId format (used across the front),
 * returns the train id in the Editoast format (used for api).
 */
export const formatTrainScheduleIdToEditoastTrainId = (trainId: TrainScheduleId): number => {
  if (!isTrainSchedule(trainId)) {
    throw new Error('The train schedule id should start with "train-"');
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
 * Given a occurrence id with a OccurrenceId format (used across the front),
 * returns the paced train id in the Editoast format (used for api).
 */
export const formatOccurrenceIdToEditoastTrainId = (occurrenceId: OccurrenceId): number => {
  if (!isOccurrence(occurrenceId)) {
    throw new Error(
      'The occurrence id should match the format "paced-{trainId}-occurrence-{occurrenceIndex}"'
    );
  }

  const formattedTrainId = Number(occurrenceId.split('-')[1]);
  const formattedOccurrenceIndex = Number(occurrenceId.split('-')[3]);

  if (Number.isNaN(formattedTrainId) || Number.isNaN(formattedOccurrenceIndex)) {
    throw new Error(`Invalid paced train ID or occurrence ID: ${occurrenceId}`);
  }

  return formattedTrainId;
};
