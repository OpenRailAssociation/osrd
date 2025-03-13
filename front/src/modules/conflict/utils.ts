import type { Conflict } from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';
import { formatTrainScheduleIdToEditoastTrainId } from 'utils/trainId';

import type { ConflictWithTrainNames } from './types';

export default function addTrainNamesToConflicts(
  conflicts: Conflict[],
  trainSchedulesDetails: TrainScheduleWithDetails[]
): ConflictWithTrainNames[] {
  const trainNameMap: { [id: number]: string } = {};

  trainSchedulesDetails.forEach(({ id, name }) => {
    // TODO Paced train : Adapt this to handle paced trains in conflict issue
    const editoastTrainId = formatTrainScheduleIdToEditoastTrainId(id);
    trainNameMap[editoastTrainId] = name;
  });

  return conflicts.map((conflict) => ({
    ...conflict,
    trainNames: conflict.train_schedule_ids.map((id) => trainNameMap[id] || ''),
  }));
}
