import { Step, TrainScheduleWithPath } from 'applications/operationalStudies/types';
import { PathWaypoint, TrainScheduleBatchItem } from 'common/api/osrdEditoastApi';
import { time2sec } from 'utils/timeManipulation';

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

export default function generateTrainSchedulesPayload(
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
