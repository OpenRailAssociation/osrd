import type {
  LinkingOccurrenceId,
  PostTrainSchedulesLinkingsApiResponse,
} from 'common/api/osrdEditoastApi';
import type { TrainId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromTrainId,
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  formatEditoastIdToExceptionId,
  formatEditoastIdToIndexedOccurrenceId,
  formatEditoastIdToTrainScheduleId,
  isAddedExceptionId,
  isIndexedOccurrenceId,
} from 'utils/trainId';

/** A linking stored by editoast, whose ends have been converted to front train IDs. */
export type ExistingLinking = {
  id: number;
  source: TrainId;
  target: TrainId;
};

export function formatTrainIdToLinkingOccurrence(trainId: TrainId): LinkingOccurrenceId {
  const trainScheduleId = extractEditoastIdFromTrainId(trainId);
  if (isIndexedOccurrenceId(trainId)) {
    return {
      type: 'paced_occurrence',
      train_schedule_id: trainScheduleId,
      occurrence_index: extractOccurrenceIndexFromOccurrenceId(trainId),
    };
  }
  if (isAddedExceptionId(trainId)) {
    return {
      type: 'added_exception',
      train_schedule_id: trainScheduleId,
      added_exception_id: extractExceptionIdFromOccurrenceId(trainId),
    };
  }
  return { type: 'unique', train_schedule_id: trainScheduleId };
}

export function parseLinkingOccurrence(occurrence: LinkingOccurrenceId): TrainId {
  const trainScheduleId = occurrence.train_schedule_id;
  switch (occurrence.type) {
    case 'paced_occurrence':
      return formatEditoastIdToIndexedOccurrenceId({
        trainScheduleId,
        occurrenceIndex: occurrence.occurrence_index,
      });
    case 'added_exception':
      return formatEditoastIdToExceptionId({
        trainScheduleId,
        exceptionId: occurrence.added_exception_id,
      });
    case 'unique':
      return formatEditoastIdToTrainScheduleId(trainScheduleId);
  }
}

/** Converts the linkings returned by editoast, whose ends it reads as front train IDs. */
export function parseLinkings(linkings: PostTrainSchedulesLinkingsApiResponse): ExistingLinking[] {
  return linkings.map(({ id, source, target }) => ({
    id,
    source: parseLinkingOccurrence(source),
    target: parseLinkingOccurrence(target),
  }));
}
