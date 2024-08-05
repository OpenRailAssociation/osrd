/* eslint-disable import/prefer-default-export */
import nextId from 'react-id-generator';

import type { ImportedTrainSchedule } from 'applications/operationalStudies/types';
import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';
import {
  calculateTimeDifferenceInSeconds,
  formatDurationAsISO8601,
  formatToISO8601,
} from 'utils/timeManipulation';

export function generateV2TrainSchedulesPayloads(
  trains: ImportedTrainSchedule[]
): TrainScheduleBase[] {
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
