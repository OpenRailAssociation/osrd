import type { Conflict } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import computeOccurrenceName from 'modules/trainschedule/helpers/computeOccurrenceName';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import { formatEditoastIdToTrainScheduleId, formatEditoastIdToPacedTrainId } from 'utils/trainId';

import type { ConflictWithTrainNames } from './types';

function getConflictTrainNames(
  conflict: Conflict,
  trainNameMap: Map<TimetableItemId, string>
): string[] {
  const trainScheduleNames = conflict.train_schedule_ids.map((id) =>
    trainNameMap.get(formatEditoastIdToTrainScheduleId(id))
  );
  const occurrenceNames = conflict.paced_train_occurrence_ids.map((occurrence) => {
    const pacedTrainName = trainNameMap.get(
      formatEditoastIdToPacedTrainId(occurrence.paced_train_id)
    );
    if (!pacedTrainName) return undefined;
    if ('index' in occurrence) {
      return computeOccurrenceName(pacedTrainName, occurrence.index);
    }
    // TODO handle paced train created exceptions
    return undefined;
  });
  return [...trainScheduleNames, ...occurrenceNames].filter((name) => name !== undefined);
}

export default function addTrainNamesToConflicts(
  conflicts: Conflict[],
  timetableItems: TimetableItemWithDetails[]
): ConflictWithTrainNames[] {
  const trainNameMap: Map<TimetableItemId, string> = new Map();
  for (const timetableItem of timetableItems) {
    trainNameMap.set(timetableItem.id, timetableItem.name);
  }

  return conflicts.map((conflict) => ({
    ...conflict,
    trainNames: getConflictTrainNames(conflict, trainNameMap),
  }));
}
