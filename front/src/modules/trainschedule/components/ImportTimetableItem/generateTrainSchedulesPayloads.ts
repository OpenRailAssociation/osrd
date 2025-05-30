/* eslint-disable import/prefer-default-export */
import nextId from 'react-id-generator';

import type { ImportedTrainSchedule } from 'applications/operationalStudies/types';
import type { PacedTrain, TrainSchedule } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

import type { ImportedPacedTrainSchedule } from './ImportTimetableItemConfig';

export function generateTrainSchedulePayload(train: ImportedTrainSchedule): TrainSchedule | null {
  const departureTime = new Date(train.departureTime);
  const { path, schedule } = train.steps.reduce<{
    path: TrainSchedule['path'];
    schedule: NonNullable<TrainSchedule['schedule']>;
  }>(
    (acc, step) => {
      const stepId = nextId();

      const validUICNumber = !Number.isNaN(step.uic);

      if (validUICNumber) {
        acc.path.push({
          key: stepId,
          uic: Number(step.uic),
          secondary_code: step.chCode,
        });
      } else {
        acc.path.push({
          key: stepId,
          trigram: step.name, // we use ocpRef when uic is NaN
          secondary_code: step.chCode ?? '',
        });
      }

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

export function generateTrainSchedulesPayloads(trains: ImportedTrainSchedule[]): TrainSchedule[] {
  return trains
    .map((train) => generateTrainSchedulePayload(train))
    .filter((payload) => payload !== null);
}

export function generatePacedTrainPayloads(trains: ImportedPacedTrainSchedule[]): PacedTrain[] {
  return trains
    .map((train) => {
      const basePayload = generateTrainSchedulePayload(train);
      if (!basePayload) return null;

      return {
        ...basePayload,
        paced: train.paced,
        exceptions: [],
      };
    })
    .filter((payload) => payload !== null);
}
