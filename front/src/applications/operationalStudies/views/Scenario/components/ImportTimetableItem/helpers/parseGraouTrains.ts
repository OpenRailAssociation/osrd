import { v4 as uuidV4 } from 'uuid';

import type { GraouTrainSchedule } from 'common/api/graouApi';
import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

import findValidTrainNameKey from './findValidTrainNameKey';
import rollingstockOpenData2OSRD from '../rollingstock_opendata2osrd.json';

/**
 *  Populate the last digit of the UIC for French stations,
 *  which is missing in schedules returned by the Graou api.
 *  It's a checksum which uses the Luhn algorithm.
 */
const populateUicChecksum = (uic: string): string => {
  if (!uic.startsWith('87') || uic.length >= 8) {
    return uic;
  }

  const rawCi = uic.substring(2);
  let checksum = 0;
  for (let i = 0; i < rawCi.length; i++) {
    const digit = Number(rawCi[i]);
    if ((i + 1) % 2 === (rawCi.length + 1) % 2) {
      checksum += digit;
    } else if (digit > 4) {
      checksum += 2 * digit - 9;
    } else {
      checksum += 2 * digit;
    }
  }
  checksum = (10 - (checksum % 10)) % 10;

  return uic + String(checksum);
};

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

/**
 * Find the osrd rolling stock matching the graou open data rolling stock name.
 * If not found, return the initial name.
 */
const matchOpenDataRollingStock = (rollingStock: string | null) => {
  if (!rollingStock) return '';

  const validRollingStockKey = findValidTrainNameKey(rollingStock);
  return validRollingStockKey ? rollingstockOpenData2OSRD[validRollingStockKey] : rollingStock;
};

function generateTrainSchedulePayload(train: GraouTrainSchedule): TrainSchedule | null {
  const departureTime = new Date(train.departureTime);
  const { path, schedule } = train.steps.reduce<{
    path: TrainSchedule['path'];
    schedule: NonNullable<TrainSchedule['schedule']>;
  }>(
    (acc, step) => {
      const stepId = uuidV4();

      const uic = Number(populateUicChecksum(step.uic));
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
    rolling_stock_name: matchOpenDataRollingStock(train.rollingStock),
    constraint_distribution: 'MARECO',
    start_time: departureTime.toISOString(),
  };
}

export function generateTrainSchedulesPayloads(trains: GraouTrainSchedule[]): TrainSchedule[] {
  return trains
    .map((train) => generateTrainSchedulePayload(train))
    .filter((payload) => payload !== null);
}
