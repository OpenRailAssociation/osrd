import type { Conflict, TrainCategory } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import type { TimetableItem, TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import {
  formatEditoastIdToTrainScheduleId,
  formatEditoastIdToPacedTrainId,
  isPacedTrainResponseWithPacedTrainId,
} from 'utils/trainId';

import type { ConflictWithTrainNames } from './types';

function getConflictTrainNames(
  conflict: Conflict,
  trainMap: Map<TimetableItemId, TimetableItem>
): string[] {
  const timetableItemNames = conflict.train_schedule_ids.map(
    (id) => trainMap.get(formatEditoastIdToTrainScheduleId(id))?.train_name
  );

  const occurrenceNames = conflict.paced_train_occurrence_ids.map((occurrence) => {
    const pacedTrain = trainMap.get(formatEditoastIdToPacedTrainId(occurrence.paced_train_id));
    if (!pacedTrain || !isPacedTrainResponseWithPacedTrainId(pacedTrain)) return undefined;

    if (!('exception_key' in occurrence)) {
      // Standard occurrence
      return computeOccurrenceName(pacedTrain.train_name, occurrence.index);
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
      return computeOccurrenceName(pacedTrain.train_name, occurrence.index);
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
    return `${pacedTrain.train_name}/+`;
  });

  const trainNames = [...timetableItemNames, ...occurrenceNames];
  return trainNames.filter((name): name is string => name !== undefined);
}

function getConflictTrainCategories(
  conflict: Conflict,
  trainMap: Map<TimetableItemId, TimetableItem>
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
      if (!pacedTrain || !isPacedTrainResponseWithPacedTrainId(pacedTrain)) return null;
      return pacedTrain?.category ?? null;
    }
  );

  const allTrainCategories: (TrainCategory | null)[] = [
    ...timetableItemCategories,
    ...occurrenceCategories,
  ];
  return allTrainCategories;
}

export default function addTrainNamesToConflicts(
  conflicts: Conflict[],
  timetableItems: TimetableItem[]
): ConflictWithTrainNames[] {
  const trainMap: Map<TimetableItemId, TimetableItem> = new Map();

  for (const timetableItem of timetableItems) {
    trainMap.set(timetableItem.id, timetableItem);
  }

  return conflicts.map((conflict) => {
    const names = getConflictTrainNames(conflict, trainMap);
    const categories = getConflictTrainCategories(conflict, trainMap);
    return {
      ...conflict,
      trainsData: names.map((name, idx) => ({ name, category: categories[idx] ?? null })),
    };
  });
}

export function filterAndReorderConflict(
  conflict: ConflictWithTrainNames,
  selectedTrainId: TrainId,
  selectedTrainName: string
): ConflictWithTrainNames | null {
  if (!selectedTrainId || !selectedTrainName) return null;

  const isInvolved = conflict.trainsData.some((train) => train.name === selectedTrainName);
  if (!isInvolved) return null;

  // If already at the front, no reorder
  if (conflict.trainsData[0]?.name === selectedTrainName) {
    return conflict;
  }

  // Find the selected train and move it to the front
  const trainsData = [...conflict.trainsData];
  const selectedTrainIndex = trainsData.findIndex((train) => train.name === selectedTrainName);
  if (selectedTrainIndex > 0) {
    const trainToMove = trainsData[selectedTrainIndex];
    trainsData.splice(selectedTrainIndex, 1);
    trainsData.unshift(trainToMove);
  }

  return {
    ...conflict,
    trainsData,
  };
}
