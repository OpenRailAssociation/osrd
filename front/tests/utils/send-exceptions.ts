import type { APIRequestContext, APIResponse } from '@playwright/test';

import type { PacedTrainException, TrainScheduleException } from 'common/api/osrdEditoastApi';

import { getApiContext, handleErrorResponse } from './api-utils';

export async function sendExceptions(
  timetableId: number,
  trainScheduleId: number,
  exceptions: PacedTrainException[]
): Promise<void> {
  for (const exception of exceptions) {
    const trainScheduleException = {
      train_schedule_id: trainScheduleId,
      occurrence_index: exception.occurrence_index,
      disabled: exception.disabled ?? false,
      change_groups: {
        constraint_distribution: exception.constraint_distribution,
        initial_speed: exception.initial_speed,
        labels: exception.labels,
        options: exception.options,
        path_and_schedule: exception.path_and_schedule,
        rolling_stock: exception.rolling_stock,
        rolling_stock_category: exception.rolling_stock_category,
        speed_limit_tag: exception.speed_limit_tag,
        start_time: exception.start_time,
        train_name: exception.train_name,
      } satisfies TrainScheduleException['change_groups'],
    };
    const apiContext: APIRequestContext = await getApiContext();
    const response: APIResponse = await apiContext.post(
      `/api/timetable/${timetableId}/train_schedule_exception`,
      {
        data: JSON.stringify(trainScheduleException),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    await handleErrorResponse(response, 'Failed to send train schedule exception');
  }
}
