/* eslint-disable import/prefer-default-export */
import nextId from 'react-id-generator';

import type { ImportedTrainSchedule } from 'applications/operationalStudies/types';
import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';
import { formatToIsoDate } from 'utils/date';
import { calculateTimeDifferenceInSeconds, formatDurationAsISO8601 } from 'utils/timeManipulation';

export function generateTrainSchedulesPayloads(
  trains: ImportedTrainSchedule[],
  checkChAndUIC: boolean = true
): TrainScheduleBase[] {
  return trains.reduce((payloads, train) => {
    const firstStep = train.steps[0];

    // Conditionally check for valid UIC in the first step
    if (checkChAndUIC && (!firstStep || !firstStep.uic)) {
      console.warn(`Skipping train ${train.trainNumber} due to invalid first step UIC`);
      return payloads; // Skip this train
    }

    const { path, schedule } = train.steps.reduce(
      (acc, step, index) => {
        const stepId = nextId();

        // Conditionally skip invalid UIC or CH code steps
        if (checkChAndUIC && !step.uic) {
          console.error(`Invalid UIC for step ${step.name}`);
          return acc; // Skip invalid step
        }
        if (checkChAndUIC && !step.chCode) {
          console.error(`Invalid CH code for step ${step.name}`);
          return acc; // Skip invalid step
        }

        acc.path.push({ id: stepId, uic: Number(step.uic), secondary_code: step.chCode });

        // Skip first step, handle time differences
        if (index !== 0) {
          const timeDifferenceInSeconds = calculateTimeDifferenceInSeconds(
            train.departureTime,
            step.arrivalTime
          );
          const schedulePoint: NonNullable<TrainScheduleBase['schedule']>[number] = {
            at: stepId,
            arrival: formatDurationAsISO8601(timeDifferenceInSeconds),
            stop_for: step.duration ? `PT${step.duration}S` : undefined,
          };
          acc.schedule.push(schedulePoint);
        }

        return acc;
      },
      {
        path: [] as TrainScheduleBase['path'],
        schedule: [] as NonNullable<TrainScheduleBase['schedule']>,
      }
    );

    payloads.push({
      path,
      train_name: train.trainNumber,
      rolling_stock_name: train.rollingStock || '',
      constraint_distribution: 'MARECO',
      schedule,
      start_time: formatToIsoDate(train.departureTime, false),
    });
    return payloads;
  }, [] as TrainScheduleBase[]);
}
