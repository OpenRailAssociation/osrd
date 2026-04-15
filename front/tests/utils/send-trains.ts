import type { APIRequestContext, APIResponse } from '@playwright/test';

import type {
  TrainSchedule,
  TrainScheduleException,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';

import { getApiContext, handleErrorResponse, postApiRequest } from './api-utils';

/**
 * Send trains to the API for a specific train_schedule_set and returns the result.
 *
 * 1. Strips paced.exceptions from the payload and sends trains first.
 * 2. If timetableId is provided, uses the returned train_schedule_ids to create
 *    each exception separately. If timetableId is absent, exceptions are ignored.
 *
 * @param trainScheduleSetId - The ID of the train_schedule_set.
 * @param body               - The request payload containing train data.
 * @param timetableId        - Optional. The ID of the timetable (used for the exception endpoint).
 *                             If not provided, exceptions are not created.
 * @returns {Promise<TrainScheduleResponse[]>} - The API response containing the train schedule response.
 */
async function sendTrains(
  trainScheduleSetId: number,
  trains: TrainSchedule[],
  timetableId?: number
): Promise<TrainScheduleResponse[]> {
  // Collect exceptions per train index before stripping them
  // Only if timetableId is provided, otherwise treat as no exceptions

  const exceptionsToCreate: {
    trainIndex: number;
    exceptions: TrainScheduleException[];
  }[] = [];

  if (timetableId !== undefined) {
    trains.forEach((train, index) => {
      if (train.paced?.exceptions) {
        exceptionsToCreate.push({
          trainIndex: index,
          exceptions: train.paced.exceptions,
        });
      }
    });
  }

  if (trains.some((train) => train.paced?.exceptions)) {
    // Strip exceptions from the payload before sending trains
    trains.forEach((train) => {
      if (train.paced?.exceptions) {
        train.paced.exceptions = [];
      }
    });
  }

  // 1. Send trains first to get their IDs
  const apiContext: APIRequestContext = await getApiContext();
  const pacedTrainsResponse: APIResponse = await apiContext.post(
    `/api/train_schedule_sets/${trainScheduleSetId}/train_schedules/`,
    {
      data: JSON.stringify(trains),
      headers: { 'Content-Type': 'application/json' },
    }
  );
  handleErrorResponse(pacedTrainsResponse, 'Failed to send paced train');
  const responseData = (await pacedTrainsResponse.json()) as TrainScheduleResponse[];

  // 2. Create exceptions using the train_schedule_id returned for each train
  if (exceptionsToCreate.length > 0) {
    const createdExceptions = await Promise.all(
      exceptionsToCreate.flatMap(({ trainIndex, exceptions }) => {
        const trainScheduleId = responseData[trainIndex]?.id;
        if (trainScheduleId === undefined) {
          throw new Error(
            `No train_schedule_id found in response for train at index ${trainIndex}`
          );
        }

        return exceptions.map(async (exception) => {
          const createdExceptionResponse: TrainScheduleException = await postApiRequest(
            `/api/timetable/${timetableId}/train_schedule_exception`,
            {
              train_schedule_id: trainScheduleId,
              disabled: exception.disabled ?? false,
              occurrence_index: exception.occurrence_index ?? null,
              change_groups: exception.change_groups,
            },
            undefined,
            `Failed to create exception for train_schedule_id ${trainScheduleId}`
          );

          return { trainIndex, exception: createdExceptionResponse };
        });
      })
    );

    // Integrate created exceptions back into responseData
    createdExceptions.forEach(({ trainIndex, exception }) => {
      const paced = responseData[trainIndex].paced;
      if (paced) {
        paced.exceptions ??= [];
        paced.exceptions.push(exception);
      }
    });
  }

  return responseData;
}

export default sendTrains;
