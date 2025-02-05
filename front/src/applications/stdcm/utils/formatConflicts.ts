import dayjs from 'dayjs';

import type { StdcmPathProperties } from 'applications/stdcm/types';
import type { Conflict } from 'common/api/osrdEditoastApi';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';

type ConflictWithInterval = {
  trainIds?: number[];
  startTime: string;
  endTime: string;
  endDate: string;
  startDate: string;
  waypointBefore: string | null;
  waypointAfter: string | null;
};

type ConflictsData = {
  trackConflictsData: ConflictWithInterval[];
  workConflictsData: (ConflictWithInterval & { workScheduleIds: number[] })[];
};

/** Helper function to find the closest operational point before or after a given position */
export const findClosestOperationalPoint = (
  operationalPoints: SuggestedOP[],
  position: number,
  direction: 'before' | 'after'
) => {
  if (direction === 'before') {
    const firstOpIndexInConflict = operationalPoints.findIndex(
      (op) => op.positionOnPath >= position
    ); // We know we will find an op (at worse it will be op at position 0)
    return operationalPoints[firstOpIndexInConflict - 1] ?? operationalPoints.at(0)!; // return the last op before the beginning of the conflict zone
  }
  return operationalPoints.find((op) => op.positionOnPath >= position)!; // return the first op after the end of the conflict zone (at worse it will be the last op from the path)
};

/** Function to get the start and end positions of each conflict */
export const formatConflicts = (
  conflicts: Conflict[],
  pathProperties: StdcmPathProperties
): ConflictsData =>
  conflicts.reduce<ConflictsData>(
    (acc, conflict) => {
      // Extract zones from conflict requirements
      const conflictZones = conflict.requirements.map((requirement) => requirement.zone);

      // Find matching boundaries from pathProperties zones and get their positions
      const matchingZones = pathProperties.zones.boundaries.filter((_, index) =>
        conflictZones.includes(pathProperties.zones.values[index] ?? '')
      );

      // If matchingZones is undefined or empty, skip this conflict
      if (!matchingZones || matchingZones.length === 0) {
        return acc;
      }

      // Determine the min start_position and max end_position of the conflict
      const start_position = Math.min(...matchingZones);
      const end_position = Math.max(...matchingZones);

      // Find the closest operational point before and after the conflict
      const waypointBefore =
        findClosestOperationalPoint(
          pathProperties.suggestedOperationalPoints,
          start_position,
          'before'
        )?.name ?? null; // Extract only the ID of the operational point before

      const waypointAfter =
        findClosestOperationalPoint(
          pathProperties.suggestedOperationalPoints,
          end_position,
          'after'
        )?.name ?? null; // Extract only the ID of the operational point after

      const formattedConflict = {
        trainIds: conflict.train_schedule_ids,
        startDate: dayjs(conflict.start_time).format('DD/MM/YYYY'),
        endDate: dayjs(conflict.end_time).format('DD/MM/YYYY'),
        startTime: dayjs(conflict.start_time).format('HH:mm'),
        endTime: dayjs(conflict.end_time).format('HH:mm'),
        waypointBefore,
        waypointAfter,
      };
      if (conflict.work_schedule_ids.length > 0) {
        acc.workConflictsData.push({
          ...formattedConflict,
          workScheduleIds: conflict.work_schedule_ids,
        });
      } else {
        acc.trackConflictsData.push(formattedConflict);
      }

      return acc;
    },
    { trackConflictsData: [], workConflictsData: [] } as ConflictsData
  );
