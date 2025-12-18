import { v4 as uuidV4 } from 'uuid';

import type { GraouTrainSchedule } from 'common/api/graouApi';
import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

import findValidTrainNameKey from './findValidTrainNameKey';
import rollingstockOpenData2OSRD from '../rollingstock_opendata2osrd.json';

export function filterInvalidSteps(importedTrainSchedules: GraouTrainSchedule[]): {
  filteredTrains: GraouTrainSchedule[];
  modifiedTrainsNumbers: string[];
} {
  const modifiedTrainsNumbers: string[] = [];

  const filteredTrains = importedTrainSchedules.map((trainSchedule) => {
    const filteredSteps = trainSchedule.steps.filter(
      (step, i) =>
        i === 0 ||
        new Date(step.arrivalTime).getTime() >=
          new Date(trainSchedule.steps[i - 1].departureTime).getTime()
    );
    if (filteredSteps.length < trainSchedule.steps.length) {
      modifiedTrainsNumbers.push(trainSchedule.trainNumber);
    }
    return { ...trainSchedule, steps: filteredSteps };
  });

  return { filteredTrains, modifiedTrainsNumbers };
}

export function updateTrainSchedules(importedTrainSchedules: GraouTrainSchedule[]) {
  // For each train schedule, we add the duration and tracks of each step
  const trainsSchedules = importedTrainSchedules.map((trainSchedule) => {
    const stepsWithDuration = trainSchedule.steps.map((step) => {
      // calcul duration in seconds between step arrival and departure
      // in case of arrival and departure are the same, we set duration to 0
      // for the step arrivalTime is before departureTime because the train first goes to the station and then leaves it
      const duration = Math.round(
        (new Date(step.departureTime).getTime() - new Date(step.arrivalTime).getTime()) / 1000
      );
      return {
        ...step,
        duration,
      };
    });
    return {
      ...trainSchedule,
      steps: stepsWithDuration,
    };
  });

  return trainsSchedules;
}

export const formatTrainsList = (trainsList: GraouTrainSchedule[]) =>
  trainsList.map(({ rollingStock, ...train }) => {
    if (!rollingStock) return { ...train, rollingStock: '' };

    const validTrainNameKey = findValidTrainNameKey(rollingStock);
    const validTrainName = validTrainNameKey
      ? rollingstockOpenData2OSRD[validTrainNameKey]
      : rollingStock;

    return { ...train, rollingStock: validTrainName };
  });

function generateTrainSchedulePayload(train: GraouTrainSchedule): TrainSchedule | null {
  const departureTime = new Date(train.departureTime);
  const { path, schedule } = train.steps.reduce<{
    path: TrainSchedule['path'];
    schedule: NonNullable<TrainSchedule['schedule']>;
  }>(
    (acc, step) => {
      const stepId = uuidV4();

      const uic = Number(step.uic);
      if (Number.isNaN(uic)) {
        throw new Error('Invalid UIC');
      }

      acc.path.push({
        id: stepId,
        location: {
          operational_point: { uic, secondary_code: step.chCode, type: 'uic' },
        },
      });

      if (acc.path.length > 1) {
        const arrivalTime = new Date(step.arrivalTime);

        acc.schedule.push({
          at: stepId,
          arrival: Duration.subtractDate(arrivalTime, departureTime).toISOString(),
          stop_for: step.duration ? `PT${step.duration}S` : undefined,
        });
      }

      return acc;
    },
    { path: [], schedule: [] }
  );
  return {
    path,
    schedule,
    train_name: train.trainNumber,
    rolling_stock_name: train.rollingStock || '',
    constraint_distribution: 'MARECO',
    start_time: departureTime.toISOString(),
  };
}

export function generateTrainSchedulesPayloads(trains: GraouTrainSchedule[]): TrainSchedule[] {
  return trains
    .map((train) => generateTrainSchedulePayload(train))
    .filter((payload) => payload !== null);
}
