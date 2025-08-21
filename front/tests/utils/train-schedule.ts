import type { APIRequestContext, APIResponse } from '@playwright/test';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';

import { getApiContext, handleErrorResponse } from './api-utils';

/**
 * Send train schedules to the API for a specific timetable and returns the result.
 *
 * @param timetableId - The ID of the timetable for which the train schedules are being sent.
 * @param body - The request payload containing train schedule data.
 * @returns {Promise<TrainScheduleResponse[]>} - The API response containing the train schedule results.
 */
async function sendTrainSchedules<T>(
  timetableId: number,
  body: T
): Promise<TrainScheduleResponse[]> {
  const apiContext: APIRequestContext = await getApiContext();
  const trainSchedulesResponse: APIResponse = await apiContext.post(
    `/api/timetable/${timetableId}/train_schedules/`,
    {
      data: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  handleErrorResponse(trainSchedulesResponse, 'Failed to send train schedule');
  const responseData = (await trainSchedulesResponse.json()) as TrainScheduleResponse[];

  return responseData;
}
export default sendTrainSchedules;
