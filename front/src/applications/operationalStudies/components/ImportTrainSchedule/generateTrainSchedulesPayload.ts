import { Step, TrainScheduleWithPath } from 'applications/operationalStudies/types';
import { PathStep } from 'common/api/osrdEditoastApi';
import { time2sec } from 'utils/timeManipulation';

// Hope for indexes are the same !
// Synchronisation is done with indexes between pathfinding not suggered positions, and required steps from importation
function mixPathPositionsAndTimes(requiredSteps: Step[], pathFindingSteps: PathStep[]) {
  const startTime = new Date(requiredSteps[0].departureTime);
  const pathFindingStepsFiltered = pathFindingSteps.filter((step) => !step.suggestion);
  const scheduledPoints: { path_offset: number; time: number }[] = [];
  requiredSteps.forEach((step, idx) => {
    if (idx !== 0) {
      const arrivalTime = new Date(step.arrivalTime);
      scheduledPoints.push({
        path_offset: pathFindingStepsFiltered[idx].path_offset,
        time: Math.round((arrivalTime.getTime() - startTime.getTime()) / 1000),
      });
    }
  });
  return scheduledPoints;
}

interface Schedule {
  train_name: string;
  rolling_stock: number;
  departure_time: number;
  initial_speed: number;
  scheduled_points: { path_offset: number; time: number }[];
}

export default function generateTrainSchedulesPayload(
  trainsWithPath: TrainScheduleWithPath[],
  timetableID: number
) {
  const trainSchedulesByPathID: Record<
    string,
    { timetable: number; path: number; schedules: Schedule[] }
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
      rolling_stock: train.rollingStockId,
      departure_time: time2sec(train.departureTime.slice(-8)),
      initial_speed: 0,
      scheduled_points: mixPathPositionsAndTimes(train.steps, train.pathFinding.steps),
    });
  });
  return Object.values(trainSchedulesByPathID);
}
