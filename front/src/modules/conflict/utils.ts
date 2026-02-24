import type { Conflict, TrainCategory } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import { isPacedTrainBase } from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItem, TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import { formatEditoastIdToPacedTrainId } from 'utils/trainId';

import type { ConflictWithTrainNames } from './types';

function getConflictTrainNames(
  conflict: Conflict,
  trainMap: Map<TimetableItemId, TimetableItem>
): string[] {
  const trainNames: string[] = [];
  conflict.train_ids.forEach((train) => {
    const pacedTrain = trainMap.get(formatEditoastIdToPacedTrainId(train.train_schedule_id));
    if (!pacedTrain) return;

    if (train.type === 'base') {
      trainNames.push(
        pacedTrain.paced
          ? computeOccurrenceName(pacedTrain.train_name, train.index)
          : pacedTrain.train_name
      );
      return;
    }

    if (!isPacedTrainBase(pacedTrain))
      throw new Error(`Train with id ${train.train_schedule_id} should be a paced train`);

    if (train.type === 'modified') {
      // Updated exception
      // Check if the exception has a name change group
      // Otherwise, compute the occurrence name
      const namedException = pacedTrain.paced.exceptions.find(
        (exception) => exception.occurrence_index === train.index && exception.train_name
      );
      trainNames.push(
        namedException
          ? namedException.train_name!.value
          : computeOccurrenceName(pacedTrain.train_name, train.index)
      );
    } else {
      // Added exception
      // Check if the exception has a name change group
      // Otherwise, the name is `${pacedTrainName}/+`
      const namedException = pacedTrain.paced.exceptions.find(
        (exception) => exception.key === train.exception_key && exception.train_name
      );
      trainNames.push(
        namedException ? namedException.train_name!.value : `${pacedTrain.train_name}/+`
      );
    }
  });

  return trainNames;
}

function getConflictTrainCategories(
  conflict: Conflict,
  trainMap: Map<TimetableItemId, TimetableItem>
): (TrainCategory | null)[] {
  // /!\ TODO: we don't use the exceptions here to get the correct categories
  return conflict.train_ids.map((train) => {
    const pacedTrain = trainMap.get(formatEditoastIdToPacedTrainId(train.train_schedule_id));
    return pacedTrain?.category ?? null;
  });
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

export const reorderConflictTrains = (
  trainsData: ConflictWithTrainNames['trainsData'],
  selectedTrainName?: string | null
): ConflictWithTrainNames['trainsData'] => {
  if (!trainsData.length) return trainsData;
  if (!selectedTrainName) {
    return [...trainsData].sort((a, b) => a.name.length - b.name.length);
  }

  // Find the selected train
  const selectedTrainIndex = trainsData.findIndex((train) => train.name === selectedTrainName);
  if (selectedTrainIndex < 0) {
    // IF not found or already first, sort by name length
    return [...trainsData].sort((a, b) => a.name.length - b.name.length);
  }

  // Move selected train to front, then sort remaining by name length
  const copy = [...trainsData];
  const [selectedTrain] = copy.splice(selectedTrainIndex, 1);
  const remainingTrains = copy.sort((a, b) => a.name.length - b.name.length);
  return [selectedTrain, ...remainingTrains];
};

export function filterAndReorderConflict(
  conflict: ConflictWithTrainNames,
  selectedTrainId: TrainId,
  selectedTrainName: string
): ConflictWithTrainNames | null {
  if (!selectedTrainId || !selectedTrainName) return null;

  const isInvolved = conflict.trainsData.some((train) => train.name === selectedTrainName);
  if (!isInvolved) return null;

  const trainsData = reorderConflictTrains(conflict.trainsData, selectedTrainName);
  return {
    ...conflict,
    trainsData,
  };
}
