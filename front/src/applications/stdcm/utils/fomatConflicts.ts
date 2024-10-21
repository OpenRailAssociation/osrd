import dayjs from 'dayjs';

import type { Conflict, PathProperties } from 'common/api/osrdEditoastApi';

interface ConflictWithInterval {
  trainIds?: number[];
  startTime: string;
  endTime: string;
  endDate: string;
  startDate: string;
  conflictType: string;
  waypointBefore: string | null;
  waypointAfter: string | null;
}

// Helper function to find the closest operational point before or after a given position
const findClosestOperationalPoint = (
  operationalPoints: PathProperties['operational_points'],
  position: number,
  direction: 'before' | 'after'
) => {
  if (direction === 'before') {
    const pointsBefore = operationalPoints?.filter((point) => point?.position <= position);
    return pointsBefore
      ? pointsBefore?.reduce((prev, curr) => (curr.position > prev.position ? curr : prev))
      : null;
  }
  const pointsAfter = operationalPoints?.filter((point) => point.position >= position);
  return pointsAfter
    ? pointsAfter?.reduce((prev, curr) => (curr.position < prev.position ? curr : prev))
    : null;
};

// Function to get the start and end positions of each conflict
// eslint-disable-next-line import/prefer-default-export
export const processConflicts = (
  conflicts: Conflict[],
  pathProperties: PathProperties
): ConflictWithInterval[] =>
  conflicts.reduce<ConflictWithInterval[]>((acc, conflict) => {
    // Extract zones from conflict requirements
    const conflictZones = conflict.requirements.map((requirement) => requirement.zone);

    // Find matching boundaries from pathProperties zones and get their positions
    const matchingZones = pathProperties.zones?.boundaries?.filter((_, index) =>
      conflictZones.includes(pathProperties.zones?.values?.[index] ?? '')
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
      findClosestOperationalPoint(pathProperties.operational_points, start_position, 'before')
        ?.extensions?.identifier?.name ?? null; // Extract only the ID of the operational point before
    const waypointAfter =
      findClosestOperationalPoint(pathProperties.operational_points, end_position, 'after')
        ?.extensions?.identifier?.name ?? null; // Extract only the ID of the operational point after

    acc.push({
      trainIds: conflict.train_ids,
      startDate: dayjs(conflict.start_time).format('DD/MM/YYYY'),
      endDate: dayjs(conflict.end_time).format('DD/MM/YYYY'),
      startTime: dayjs(conflict.start_time).format('HH:mm'),
      endTime: dayjs(conflict.end_time).format('HH:mm'),
      conflictType: conflict.conflict_type,
      waypointBefore,
      waypointAfter,
    });

    return acc;
  }, []);
