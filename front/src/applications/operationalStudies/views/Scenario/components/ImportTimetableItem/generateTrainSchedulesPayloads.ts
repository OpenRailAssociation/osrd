import { v4 as uuidV4 } from 'uuid';

import type { GraouTrainSchedule } from 'common/api/graouApi';
import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

function generateTrainSchedulePayload(train: GraouTrainSchedule): TrainSchedule | null {
  const departureTime = new Date(train.departureTime);
  const { path, schedule } = train.steps.reduce<{
    path: TrainSchedule['path'];
    schedule: NonNullable<TrainSchedule['schedule']>;
  }>(
    (acc, step) => {
      const stepId = uuidV4();

      const validUICNumber = !Number.isNaN(step.uic);

      if (validUICNumber) {
        acc.path.push({
          id: stepId,
          uic: Number(step.uic),
          secondary_code: step.chCode,
        });
      } else {
        acc.path.push({
          id: stepId,
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

export default function generateTrainSchedulesPayloads(
  trains: GraouTrainSchedule[]
): TrainSchedule[] {
  return trains
    .map((train) => generateTrainSchedulePayload(train))
    .filter((payload) => payload !== null);
}
