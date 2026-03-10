import type { APIRequestContext, APIResponse } from '@playwright/test';

import type {
  PacedTrainException,
  TrainSchedule,
  TrainScheduleException,
  TrainScheduleExceptionChangeGroups,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';

import { getApiContext, handleErrorResponse, postApiRequest } from './api-utils';
import type { ExceptionFormat } from './types';

const CHANGE_GROUP_KEYS: ReadonlyArray<keyof TrainScheduleExceptionChangeGroups> = [
  'constraint_distribution',
  'initial_speed',
  'labels',
  'options',
  'path_and_schedule',
  'rolling_stock',
  'rolling_stock_category',
  'speed_limit_tag',
  'start_time',
  'train_name',
];

/**
 * Convert TrainScheduleException (API format with nested change_groups)
 * to PacedTrainException (frontend format with flat change groups)
 */
const convertToPacedTrainException = (
  apiException: TrainScheduleException
): PacedTrainException => {
  const { change_groups, disabled, id, key, occurrence_index } = apiException;

  return {
    ...change_groups,
    disabled,
    id,
    key: key ?? '',
    occurrence_index,
  };
};

/**
 * Extract change groups from an exception.
 * Handles both formats:
 * - Direct properties (matching PacedTrainException type)
 * - Nested in 'change_groups' object (legacy format from JSON files)
 */
const extractChangeGroups = (exception: ExceptionFormat): TrainScheduleExceptionChangeGroups => {
  // Check if exception has change_groups property (legacy JSON format)
  if ('change_groups' in exception && exception.change_groups) {
    return exception.change_groups;
  }

  // Otherwise, extract from direct properties (standard format)
  const pacedException = exception as PacedTrainException;
  return Object.fromEntries(
    CHANGE_GROUP_KEYS.filter((key) => pacedException[key] !== undefined).map((key) => [
      key,
      pacedException[key],
    ])
  ) as TrainScheduleExceptionChangeGroups;
};

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
    exceptions: ExceptionFormat[];
  }[] = [];

  if (timetableId !== undefined) {
    trains.forEach((train, index) => {
      if (train.paced?.exceptions) {
        exceptionsToCreate.push({
          trainIndex: index,
          exceptions: train.paced.exceptions as ExceptionFormat[],
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
          const changeGroups = extractChangeGroups(exception);

          const createdExceptionResponse: TrainScheduleException = await postApiRequest(
            `/api/timetable/${timetableId}/train_schedule_exception`,
            {
              train_schedule_id: trainScheduleId,
              disabled: exception.disabled ?? false,
              occurrence_index: exception.occurrence_index ?? null,
              change_groups: changeGroups,
            },
            undefined,
            `Failed to create exception for train_schedule_id ${trainScheduleId}`
          );

          // Convert API format (TrainScheduleException with nested change_groups)
          // to frontend format (PacedTrainException with flat change groups)
          const createdException = convertToPacedTrainException(createdExceptionResponse);

          return { trainIndex, exception: createdException };
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
