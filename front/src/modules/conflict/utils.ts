import type { Conflict } from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';

import type { ConflictWithTrainNames } from './types';

export default function addTrainNamesToConflicts(
  conflicts: Conflict[],
  trainSchedulesDetails: TrainScheduleWithDetails[]
): ConflictWithTrainNames[] {
  const trainNameMap: { [id: number]: string } = {};

  trainSchedulesDetails.forEach(({ id, trainName }) => {
    trainNameMap[id] = trainName;
  });

  return conflicts.map((conflict) => ({
    ...conflict,
    trainNames: conflict.train_ids.map((id) => trainNameMap[id] || ''),
  }));
}
