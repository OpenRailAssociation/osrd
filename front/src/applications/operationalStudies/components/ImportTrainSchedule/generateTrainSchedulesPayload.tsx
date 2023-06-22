import { Step } from 'applications/operationalStudies/types';
import { time2sec } from 'utils/timeManipulation';

type ScheduledPoint = {
  position: number;
  time: number;
};
type Train = {
  path: number;
  departureTime: string;
  steps: Step[];
  trainNumber: string;
  rollingStockId: string;
  pathId: number;
};

type TrainSchedulesByPathID = {
  [path: number]: {
    timetable: number;
    path: number;
    schedules: {
      train_name: string;
      rolling_stock: string;
      departure_time: number;
      initial_speed: number;
      scheduled_points: ScheduledPoint[];
    }[];
  };
};

export default function generateTrainSchedulesPayload(
  trainsWithPathRef: Train[],
  _infraID: number,
  timetableID: number
): TrainSchedulesByPathID {
  const trainSchedulesByPathID: TrainSchedulesByPathID = {};
  trainsWithPathRef.forEach((train) => {
    if (!trainSchedulesByPathID[train.path]) {
      trainSchedulesByPathID[train.path] = {
        timetable: timetableID,
        path: train.pathId,
        schedules: [],
      };
    }

    const depTime = new Date(train.departureTime);
    const scheduledPoints: ScheduledPoint[] = [];
    train.steps.forEach((step: Step) => {
      const arrTime = new Date(step.arrivalTime);
      if (arrTime.getTime() > depTime.getTime()) {
        scheduledPoints.push({
          position: 42 /* for (let i = 0; i < itineraryCreated.length; i++) {
            let itineraryStep = itineraryCreated[i];
            for (let j = 0; j < scheduledPoints.length; j++) {
              let scheduledPointsStep = scheduledPoints[j];
              if (itineraryStep.time === scheduledPointsStep.time) {
                scheduledPointsStep.position = itineraryStep.position;
                break; // On passe au prochain step de itineraryCreated
              }
            }
          }
          */,
          time: (arrTime.getTime() - depTime.getTime()) / 1000,
        });
      }
    });
    const { pathId } = train;
    if (!trainSchedulesByPathID[pathId]) {
      trainSchedulesByPathID[pathId] = {
        timetable: timetableID,
        path: train.pathId,
        schedules: [],
      };
    }
    trainSchedulesByPathID[pathId].schedules.push({
      train_name: train.trainNumber,
      rolling_stock: train.rollingStockId,
      departure_time: time2sec((train.departureTime as string).slice(-8)),
      initial_speed: 0,
      scheduled_points: scheduledPoints,
    });
  });
  return trainSchedulesByPathID;
}
