import type { PacedTrainWithPaced } from 'applications/operationalStudies/types';
import type { OccurrenceId } from 'reducers/osrdconf/types';

import {
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  isAddedExceptionId,
} from './trainId';

/**
 * Given an occurrence id, find the proper exception object from a paced train.
 */
export const findExceptionInPacedTrainByOccurenceId = (
  occurenceId: OccurrenceId,
  pacedTrain: PacedTrainWithPaced
) =>
  pacedTrain.paced.exceptions.find((exception) =>
    isAddedExceptionId(occurenceId)
      ? exception.id === extractExceptionIdFromOccurrenceId(occurenceId)
      : exception.occurrence_index === extractOccurrenceIndexFromOccurrenceId(occurenceId)
  );
