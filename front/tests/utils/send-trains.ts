import type { APIRequestContext, APIResponse } from '@playwright/test';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';

import { getApiContext, handleErrorResponse } from './api-utils';

/**
 * Send paced trains to the API for a specific train_schedule_set and returns the result.
 *
 * @param trainScheduleSetId - The ID of the train_schedule_set for which the paced trains are being sent.
 * @param body - The request payload containing paced train data.
 * @returns {Promise<TrainScheduleResponse[]>} - The API response containing the train schedule response.
 */
async function sendTrains<T>(
  trainScheduleSetId: number,
  body: T
): Promise<TrainScheduleResponse[]> {
  const apiContext: APIRequestContext = await getApiContext();
  const pacedTrainsResponse: APIResponse = await apiContext.post(
    `/api/train_schedule_sets/${trainScheduleSetId}/train_schedules/`,
    {
      data: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  handleErrorResponse(pacedTrainsResponse, 'Failed to send paced train');
  const responseData = (await pacedTrainsResponse.json()) as TrainScheduleResponse[];

  return responseData;
}

export default sendTrains;
