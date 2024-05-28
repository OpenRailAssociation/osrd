import type { ConflictV2 } from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/TimetableV2/types';

import type { ConflictWithTrainNames } from './types';

export default function addTrainNamesToConflicts(
  conflicts: ConflictV2[],
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
