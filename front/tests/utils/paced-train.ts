import type { APIRequestContext, APIResponse } from '@playwright/test';

import type { PacedTrainResponse } from 'common/api/osrdEditoastApi';

import { getApiContext, handleErrorResponse } from './api-utils';

/**
 * Send paced trains to the API for a specific timetable and returns the result.
 *
 * @param timetableId - The ID of the timetable for which the paced trains are being sent.
 * @param body - The request payload containing paced train data.
 * @returns {Promise<PacedTrainResponse[]>} - The API response containing the paced train response.
 */
export async function sendPacedTrains<T>(
  timetableId: number,
  body: T
): Promise<PacedTrainResponse[]> {
  const apiContext: APIRequestContext = await getApiContext();
  const pacedTrainsResponse: APIResponse = await apiContext.post(
    `/api/timetable/${timetableId}/paced_trains/`,
    {
      data: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  handleErrorResponse(pacedTrainsResponse, 'Failed to send paced train');
  const responseData = (await pacedTrainsResponse.json()) as PacedTrainResponse[];

  return responseData;
}

export default sendPacedTrains;
