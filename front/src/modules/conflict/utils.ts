import type { Conflict, TrainCategory, TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/trainSchedule/helpers/computeOccurrenceName';
import { isPacedTrainBase } from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainId } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';

import type { ConflictWithTrainNames } from './types';

function getConflictTrainNames(
  conflict: Conflict,
  trainMap: Map<number, TrainScheduleResponse>
): string[] {
  const trainNames: string[] = [];
  conflict.train_ids.forEach((train) => {
    const trainSchedule = trainMap.get(train.train_schedule_id);
    if (!trainSchedule) return;

    if (train.type === 'base') {
      trainNames.push(
        trainSchedule.paced
          ? computeOccurrenceName(trainSchedule.train_name, train.index)
          : trainSchedule.train_name
      );
      return;
    }

    // The train might have been converted from paced to unique but the conflicts
    // haven't been re-fetched yet. In that case, fall back to the train name.
    if (!isPacedTrainBase(trainSchedule)) {
      trainNames.push(trainSchedule.train_name);
      return;
    }

    if (train.type === 'modified') {
      // Updated exception
      // Check if the exception has a name change group
      // Otherwise, compute the occurrence name
      const namedException = trainSchedule.paced.exceptions.find(
        (exception) => exception.occurrence_index === train.index && exception.train_name
      );
      trainNames.push(
        namedException
          ? namedException.train_name!.value
          : computeOccurrenceName(trainSchedule.train_name, train.index)
      );
    } else {
      // Added exception
      // Check if the exception has a name change group
      // Otherwise, the name is `${pacedTrainName}/+`
      const namedException = trainSchedule.paced.exceptions.find(
        // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
        (exception) => exception.id! === train.exception_id && exception.train_name
      );
      trainNames.push(
        namedException ? namedException.train_name!.value : `${trainSchedule.train_name}/+`
      );
    }
  });

  return trainNames;
}

function getConflictTrainCategories(
  conflict: Conflict,
  trainMap: Map<number, TrainScheduleResponse>
): (TrainCategory | null)[] {
  // /!\ TODO: we don't use the exceptions here to get the correct categories
  return conflict.train_ids.map((train) => {
    const trainSchedule = trainMap.get(train.train_schedule_id);
    return trainSchedule?.category ?? null;
  });
}

export default function addTrainNamesToConflicts(
  conflicts: Conflict[],
  trainSchedules: TrainScheduleResponse[]
): ConflictWithTrainNames[] {
  const trainMap: Map<number, TrainScheduleResponse> = new Map();

  for (const trainSchedule of trainSchedules) {
    trainMap.set(trainSchedule.id, trainSchedule);
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

/**
 * For an hourly timetable, editoast wraps every paced train repetition into the
 * timetable's period, so a conflict caused by a pattern repeating every `period` can be
 * reported once per repetition. Keep only conflicts starting within [0, period) and drop
 * exact duplicates (same type/start/duration/trains) among those.
 */
export function dedupeHourlyConflicts(conflicts: Conflict[], period: Duration): Conflict[] {
  const seenKeys = new Set<string>();
  const dedupedConflicts: Conflict[] = [];

  for (const conflict of conflicts) {
    if (conflict.start_time < 0 || conflict.start_time >= period.ms) continue;

    // Train ids are serialized then sorted so that two conflicts listing the same trains in
    // a different order share the same key.
    const trainIds = conflict.train_ids.map((train) => JSON.stringify(train)).sort();
    const key = [conflict.conflict_type, conflict.start_time, conflict.duration, ...trainIds].join(
      '|'
    );
    if (seenKeys.has(key)) continue;

    seenKeys.add(key);
    dedupedConflicts.push(conflict);
  }

  return dedupedConflicts;
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

export const reorderConflictTrainsByScheduleId = (
  conflict: ConflictWithTrainNames,
  selectedTrainScheduleId: number
): ConflictWithTrainNames['trainsData'] => {
  const { trainsData, train_ids: trainIds } = conflict;
  if (!trainsData.length) return trainsData;

  const selectedTrains: ConflictWithTrainNames['trainsData'] = [];
  const otherTrains: ConflictWithTrainNames['trainsData'] = [];
  trainsData.forEach((train, idx) => {
    if (trainIds[idx]?.train_schedule_id === selectedTrainScheduleId) {
      selectedTrains.push(train);
    } else {
      otherTrains.push(train);
    }
  });

  otherTrains.sort((a, b) => a.name.length - b.name.length);
  return [...selectedTrains, ...otherTrains];
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
