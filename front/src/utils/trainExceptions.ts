import type { PacedTrain } from 'applications/operationalStudies/types';
import type { OccurrenceId } from 'reducers/osrdconf/types';

import {
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  isAddedExceptionId,
} from './trainId';

/**
 * Given an occurrence id, find the proper exception object from a paced train.
 */
export const findExceptionInPacedTrainByOccurrenceId = (
  occurrenceId: OccurrenceId,
  pacedTrain: PacedTrain
) =>
  pacedTrain.paced.exceptions.find((exception) =>
    isAddedExceptionId(occurrenceId)
      ? exception.id === extractExceptionIdFromOccurrenceId(occurrenceId)
      : exception.occurrence_index === extractOccurrenceIndexFromOccurrenceId(occurrenceId)
  );
