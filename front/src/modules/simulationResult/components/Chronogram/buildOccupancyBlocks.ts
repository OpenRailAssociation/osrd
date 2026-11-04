import type { LevelCrossingData, LevelCrossingOccupancies } from '@osrd-project/ui-charts';

import type {
  LevelCrossing,
  PostInfraByInfraIdObjectsAndObjectTypeApiResponse,
  PostLevelCrossingOccupancyApiResponse,
} from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

const MIN_GAP_BETWEEN_OCCUPANCIES_MS = 15_000; // 15 seconds

/**
 * This function takes all the occupancy periods for a level crossing and organizes them into groups.
 * If two occupancies overlap, we merge them, or if the gap between them is very short (less than 15 seconds),
 * we consider them as part of the same group.
 */
function computeOccupanciesBlocks(
  occupancies: PostLevelCrossingOccupancyApiResponse[number],
  trainNameById: Map<number, string>
): LevelCrossingOccupancies {
  const sortedOccupancies = occupancies
    .map((occupancy) => ({
      startTime: occupancy.time_begin,
      endTime: occupancy.time_begin + Duration.parse(occupancy.duration).ms,
      trainNames: [trainNameById.get(occupancy.train_schedule_id) ?? ''],
    }))
    .sort((a, b) => a.startTime - b.startTime);

  const result = sortedOccupancies.reduce<LevelCrossingOccupancies>(
    (occupanciesGroups, occupancy) => {
      const currentGroup = occupanciesGroups.at(-1);
      const lastOccupancy = currentGroup?.at(-1);
      if (!currentGroup || !lastOccupancy) {
        occupanciesGroups.push([occupancy]);
      } else if (occupancy.startTime <= lastOccupancy.endTime) {
        lastOccupancy.endTime = Math.max(lastOccupancy.endTime, occupancy.endTime);
        lastOccupancy.trainNames.push(...occupancy.trainNames);
      } else if (occupancy.startTime - lastOccupancy.endTime < MIN_GAP_BETWEEN_OCCUPANCIES_MS) {
        currentGroup.push(occupancy);
      } else {
        occupanciesGroups.push([occupancy]);
      }
      return occupanciesGroups;
    },
    []
  );
  return result;
}

/**
 * Level crossings without metadata (unknown ids are returned as null by editoast) are ignored.
 */
export function formatLevelCrossingOccupanciesForChronogram(
  levelCrossingOccupancies: PostLevelCrossingOccupancyApiResponse,
  levelCrossingsMetadata: PostInfraByInfraIdObjectsAndObjectTypeApiResponse,
  trainNameById: Map<number, string>
): LevelCrossingData[] {
  return Object.entries(levelCrossingOccupancies)
    .flatMap(([levelCrossingId, occupancies]) => {
      const metadata = levelCrossingsMetadata[levelCrossingId];
      if (!metadata) return [];
      const levelCrossing = metadata.railjson as LevelCrossing;
      return [
        {
          name: levelCrossing.name,
          occupancies: computeOccupanciesBlocks(occupancies, trainNameById),
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
