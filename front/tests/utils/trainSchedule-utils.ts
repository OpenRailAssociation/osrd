import type { APIResponse, APIRequestContext } from '@playwright/test';

import { postApiRequest, getApiContext } from './api-setup';

// Function to import train schedules and return the API response
export async function sendTrainSchedule(timetableId: number, body: object): Promise<APIResponse> {
  const apiContext: APIRequestContext = await getApiContext();
  const trainScheduleResponse: APIResponse = await apiContext.post(
    `/api/v2/timetable/${timetableId}/train_schedule/`,
    {
      data: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!trainScheduleResponse.ok()) {
    throw new Error(
      `Failed to send train schedule: ${trainScheduleResponse.status()} ${trainScheduleResponse.statusText()}`
    );
  }

  return trainScheduleResponse;
}

// Function to extract train IDs from the train schedules
export async function getTrainIds(
  trainScheduleResponse: APIResponse
): Promise<number[] | undefined> {
  if (Array.isArray(trainScheduleResponse)) {
    return trainScheduleResponse.map((item: { id: number }) => item.id);
  }
  return undefined;
}

// Function to post simulation using extracted train IDs
export async function postSimulation(response: APIResponse, infraId: number): Promise<void> {
  const trainIds = await getTrainIds(response);
  if (trainIds && trainIds.length > 0) {
    const simulationResponse = await postApiRequest(`/api/v2/train_schedule/simulation_summary/`, {
      ids: trainIds,
      infra_id: infraId,
    });
    if (!simulationResponse.ok()) {
      throw new Error(
        `Failed to post simulation: ${simulationResponse.status()} ${simulationResponse.statusText()}`
      );
    }
  }
}
