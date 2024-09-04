/* eslint-disable import/prefer-default-export */
import nextId from 'react-id-generator';

import type { ImportedTrainSchedule } from 'applications/operationalStudies/types';
import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';
import { formatToIsoDate } from 'utils/date';
import { calculateTimeDifferenceInSeconds, formatDurationAsISO8601 } from 'utils/timeManipulation';

export function generateTrainSchedulesPayloads(
  trains: ImportedTrainSchedule[]
): TrainScheduleBase[] {
  return trains.reduce((payloads, train) => {
    // Check if the first step has a valid UIC
    const firstStep = train.steps[0];
    if (!firstStep || !firstStep.uic) {
      console.warn(`Skipping train ${train.trainNumber} due to invalid first step UIC`);
      return payloads; // Skip this train
    }

    const { path, schedule } = train.steps.reduce(
      (acc, step, index) => {
        const stepId = nextId();
        if (!step.uic) {
          console.error(`Invalid UIC for step ${step.name}`);
          return acc; // Skip invalid step
        }
        if (!step.chCode) {
          console.error(`Invalid CH code for step ${step.name}`);
          return acc; // Skip invalid step
        }

        acc.path.push({ id: stepId, uic: Number(step.uic), secondary_code: step.chCode });

        // Skip the first step in the schedule
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
