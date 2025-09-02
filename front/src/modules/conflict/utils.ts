import type { Conflict, TrainCategory } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import {
  formatEditoastIdToTrainScheduleId,
  formatEditoastIdToPacedTrainId,
  isPacedTrainWithDetails,
} from 'utils/trainId';

import type { ConflictWithTrainNames } from './types';

function getConflictTrainNames(
  conflict: Conflict,
  trainMap: Map<TimetableItemId, TimetableItemWithDetails>
): string[] {
  const timetableItemNames = conflict.train_schedule_ids.map(
    (id) => trainMap.get(formatEditoastIdToTrainScheduleId(id))?.name
  );

  const occurrenceNames = conflict.paced_train_occurrence_ids.map((occurrence) => {
    const pacedTrain = trainMap.get(formatEditoastIdToPacedTrainId(occurrence.paced_train_id));
    if (!pacedTrain || !isPacedTrainWithDetails(pacedTrain)) return undefined;

    if (!('exception_key' in occurrence)) {
      // Standard occurrence
      return computeOccurrenceName(pacedTrain.name, occurrence.index);
    }

    if ('index' in occurrence) {
      // Updated exception
      // Check if the exception has a name change group
      // Otherwise, compute the occurrence name
      const namedException = pacedTrain.exceptions.find(
        (exception) => exception.occurrence_index === occurrence.index && exception.train_name
      );
      if (namedException) {
        return namedException.train_name!.value;
      }
      return computeOccurrenceName(pacedTrain.name, occurrence.index);
    }

    // Added exception
    // Check if the exception has a name change group
    // Otherwise, the name is `${pacedTrainName}/+`

    const namedException = pacedTrain.exceptions.find(
      (exception) => exception.key === occurrence.exception_key && exception.train_name
    );
    if (namedException) {
      return namedException.train_name!.value;
    }
    return `${pacedTrain.name}/+`;
  });

  const trainNames = [...timetableItemNames, ...occurrenceNames];
  return trainNames.filter((name): name is string => name !== undefined);
}

function getConflictTrainCategories(
  conflict: Conflict,
  trainMap: Map<TimetableItemId, TimetableItemWithDetails>
): (TrainCategory | null)[] {
  const timetableItemCategories: (TrainCategory | null)[] = conflict.train_schedule_ids.map(
    (id) => {
      const train = trainMap.get(formatEditoastIdToTrainScheduleId(id));
      return train?.category ?? null;
    }
  );

  const occurrenceCategories: (TrainCategory | null)[] = conflict.paced_train_occurrence_ids.map(
    (occurrence) => {
      const pacedTrain = trainMap.get(formatEditoastIdToPacedTrainId(occurrence.paced_train_id));
      if (!pacedTrain || !isPacedTrainWithDetails(pacedTrain)) return null;
      return pacedTrain?.category ?? null;
    }
  );

  return [...timetableItemCategories, ...occurrenceCategories];
}

export default function addTrainNamesToConflicts(
  conflicts: Conflict[],
  timetableItems: TimetableItemWithDetails[]
): ConflictWithTrainNames[] {
  const trainMap: Map<TimetableItemId, TimetableItemWithDetails> = new Map();

  for (const timetableItem of timetableItems) {
    trainMap.set(timetableItem.id, timetableItem);
  }

  return conflicts.map((conflict) => ({
    ...conflict,
    trainNames: getConflictTrainNames(conflict, trainMap),
    trainCategories: getConflictTrainCategories(conflict, trainMap),
  }));
}
