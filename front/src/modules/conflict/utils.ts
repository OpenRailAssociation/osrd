import type { Conflict } from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';
import { formatTrainScheduleIdToEditoastTrainId } from 'utils/trainId';

import type { ConflictWithTrainNames } from './types';

export default function addTrainNamesToConflicts(
  conflicts: Conflict[],
  trainSchedulesDetails: TrainScheduleWithDetails[]
): ConflictWithTrainNames[] {
  const trainNameMap: { [id: number]: string } = {};

  trainSchedulesDetails.forEach(({ id, trainName }) => {
    // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
    const editoastTrainId = formatTrainScheduleIdToEditoastTrainId(id);
    trainNameMap[editoastTrainId] = trainName;
  });

  return conflicts.map((conflict) => ({
    ...conflict,
    trainNames: conflict.train_schedule_ids.map((id) => trainNameMap[id] || ''),
  }));
}
