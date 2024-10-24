import type { APIRequestContext, APIResponse } from '@playwright/test';

import type { TrainScheduleResult } from 'common/api/osrdEditoastApi';

import { getApiContext, handleErrorResponse, postApiRequest } from './api-setup';

/**
 * Sends train schedules to the API for a specific timetable and returns the result.
 *
 * @param {number} timetableId - The ID of the timetable for which the train schedules are being sent.
 * @param {object} body - The request payload containing train schedule data.
 * @returns {Promise<TrainScheduleResult[]>} - The API response containing the train schedule results.
 */
export async function sendTrainSchedules(
  timetableId: number,
  body: JSON
): Promise<TrainScheduleResult[]> {
  const apiContext: APIRequestContext = await getApiContext();
  const trainSchedulesResponse: APIResponse = await apiContext.post(
    `/api/timetable/${timetableId}/train_schedule/`,
    {
      data: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  handleErrorResponse(trainSchedulesResponse, 'Failed to send train schedule');
  const responseData = (await trainSchedulesResponse.json()) as TrainScheduleResult[];

  return responseData;
}

/**
 * Extracts the train IDs from an array of train schedule results.
 *
 * @param {TrainScheduleResult[]} trainSchedules - An array of train schedule results.
 * @returns {number[]} - An array of train IDs extracted from the train schedules.
 */
export function getTrainIds(trainSchedules: TrainScheduleResult[]) {
  return trainSchedules.map((item: TrainScheduleResult) => item.id);
}

/**
 * Posts a simulation summary for the provided train IDs and infrastructure ID.
 *
 * @param {TrainScheduleResult[]} response - The train schedule results from which to extract train IDs.
 * @param {number} infraId - The infrastructure ID for the simulation.
 * @returns {Promise<void>} - A promise that resolves once the simulation is posted.
 */
export async function postSimulation(
  response: TrainScheduleResult[],
  infraId: number
): Promise<void> {
  const trainIds = getTrainIds(response);
  if (trainIds.length > 0) {
    await postApiRequest(
      `/api/train_schedule/simulation_summary/`,
      { ids: trainIds, infra_id: infraId },
      undefined,
      'Failed to post simulation'
    );
  }
}
