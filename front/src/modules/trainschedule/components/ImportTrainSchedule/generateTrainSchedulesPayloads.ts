import nextId from 'react-id-generator';

import type {
  Step,
  TrainScheduleV2,
  TrainScheduleWithPath,
} from 'applications/operationalStudies/types';
import type {
  PathWaypoint,
  TrainScheduleBase,
  TrainScheduleBatchItem,
  TrainScheduleForm,
} from 'common/api/osrdEditoastApi';
import {
  calculateTimeDifferenceInSeconds,
  formatDurationAsISO8601,
  formatToISO8601,
  time2sec,
} from 'utils/timeManipulation';

// Hope for indexes are the same !
// Synchronisation is done with indexes between pathfinding not suggested positions, and required steps from importation
function mixPathPositionsAndTimes(requiredSteps: Step[], pathFindingWaypoints: PathWaypoint[]) {
  const startTime = new Date(requiredSteps[0].departureTime);
  const pathFindingStepsFiltered = pathFindingWaypoints.filter((waypoint) => !waypoint.suggestion);
  const scheduledPoints: { path_offset: number; time: number }[] = [];
  requiredSteps.forEach((waypoint, idx) => {
    if (idx !== 0) {
      const arrivalTime = new Date(waypoint.arrivalTime);
      scheduledPoints.push({
        path_offset: pathFindingStepsFiltered[idx].path_offset,
        time: Math.round((arrivalTime.getTime() - startTime.getTime()) / 1000),
      });
    }
  });
  return scheduledPoints;
}

export default function generateTrainSchedulesPayloads(
  trainsWithPath: TrainScheduleWithPath[],
  timetableID: number
) {
  const trainSchedulesByPathID: Record<
    string,
    { timetable: number; path: number; schedules: TrainScheduleBatchItem[] }
  > = {};
  trainsWithPath.forEach((train) => {
    if (!trainSchedulesByPathID[train.pathId]) {
      trainSchedulesByPathID[train.pathId] = {
        timetable: timetableID,
        path: train.pathId,
        schedules: [],
      };
    }
    trainSchedulesByPathID[train.pathId].schedules.push({
      train_name: train.trainNumber,
      rolling_stock_id: train.rollingStockId,
      departure_time: time2sec(train.departureTime.slice(-8)),
      initial_speed: 0,
      scheduled_points: mixPathPositionsAndTimes(train.steps, train.pathFinding.steps),
    });
  });
  return Object.values(trainSchedulesByPathID);
}

export function generateV2TrainSchedulesPayloads(trains: TrainScheduleV2[]): TrainScheduleBase[] {
  return trains.map((train) => {
    const { path, schedule } = train.steps.reduce(
      (acc, step, index) => {
        const stepId = nextId();

        acc.path.push({ id: stepId, uic: Number(step.uic) });
        if (index !== 0) {
          const timeDifferenceInSeconds = calculateTimeDifferenceInSeconds(
            train.departureTime,
            step.arrivalTime
          );
          const isoDuration = formatDurationAsISO8601(timeDifferenceInSeconds);
          acc.schedule.push({
            at: stepId,
            arrival: isoDuration,
            ...(step.duration ? { stop_for: `PT${step.duration}S` } : {}),
          });
        }
        return acc;
      },
      {
        path: [] as TrainScheduleBase['path'],
        schedule: [] as NonNullable<TrainScheduleBase['schedule']>,
      }
    );
    return {
      path,
      train_name: train.trainNumber,
      rolling_stock_name: train.rollingStock || '',
      constraint_distribution: 'MARECO',
      schedule,
      start_time: formatToISO8601(train.departureTime),
    };
  });
}
