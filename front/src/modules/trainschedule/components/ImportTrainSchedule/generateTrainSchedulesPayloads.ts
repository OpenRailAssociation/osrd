/* eslint-disable import/prefer-default-export */
import nextId from 'react-id-generator';

import type { ImportedTrainSchedule } from 'applications/operationalStudies/types';
import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';
import { formatToIsoDate } from 'utils/date';
import { calculateTimeDifferenceInSeconds, formatDurationAsISO8601 } from 'utils/timeManipulation';

export function generateTrainSchedulesPayloads(
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
          const schedulePoint = {
            at: stepId,
            arrival: formatDurationAsISO8601(timeDifferenceInSeconds),
            stop_for: null as string | null,
          };
          if (step.duration || index === train.steps.length - 1) {
            schedulePoint.stop_for = `PT${step.duration || 0}S`;
          }
          acc.schedule.push(schedulePoint);
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
      start_time: formatToIsoDate(train.departureTime),
    };
  });
}
