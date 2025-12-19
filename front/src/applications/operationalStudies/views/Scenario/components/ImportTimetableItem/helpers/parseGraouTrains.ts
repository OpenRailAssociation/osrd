import { v4 as uuidV4 } from 'uuid';

import type { GraouTrainSchedule } from 'common/api/graouApi';
import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

import rollingstockOpenData2OSRD from '../rollingstock_opendata2osrd.json';

/**
 * For an array of graou train schedules,
 * filter out steps with an arrival time set before the previous step departure time.
 *
 * Returns both the train schedules with those steps removed, as well as the name of each modified train.
 */

export const filterInvalidSteps = (
  importedTrainSchedules: GraouTrainSchedule[]
): {
  filteredTrains: GraouTrainSchedule[];
  modifiedTrainsNumbers: string[];
} => {
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
};

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

/**
 * Normalize a rolling stock name by:
 * - upper-casing
 * - removing any non ASCII letter or digit character
 */
const normalizeRsName = (rollingStock: string): string =>
  rollingStock.toUpperCase().replace(/[_\W]/g, '');

/**
 * Find the osrd rolling stock matching the graou open data rolling stock name.
 * If not found, return the initial name.
 */
const matchOpenDataRollingStock = (rollingStock: string | null) => {
  if (!rollingStock) return '';

  const normalizedRollingStock = normalizeRsName(rollingStock);
  const matchedRollingStock = Object.entries(rollingstockOpenData2OSRD).find(
    ([key, value]) =>
      normalizedRollingStock.includes(normalizeRsName(key)) ||
      normalizedRollingStock.includes(normalizeRsName(value))
  )?.[1];

  return matchedRollingStock ?? rollingStock;
};

/**
 * Generate an osrd train schedule payload from a graou train schedule.
 */
const generateTrainSchedulePayload = (train: GraouTrainSchedule): TrainSchedule | null => {
  const trainStartTime = new Date(train.departureTime);
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
        const departureTime = new Date(step.departureTime);
        const stopForDuration = Duration.subtractDate(departureTime, arrivalTime);

        acc.schedule.push({
          at: stepId,
          arrival: Duration.subtractDate(arrivalTime, trainStartTime).toISOString(),
          stop_for: stopForDuration.ms !== 0 ? stopForDuration.toISOString() : undefined, // Our parsing does not support 0s stops and treat them as steps without stops
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
    start_time: trainStartTime.toISOString(),
  };
};

/**
 * Generate osrd train schedule payloads from an array of graou train schedules.
 */
export const generateTrainSchedulesPayloads = (trains: GraouTrainSchedule[]): TrainSchedule[] =>
  trains.map((train) => generateTrainSchedulePayload(train)).filter((payload) => payload !== null);
