import { isEmpty } from 'lodash';

import {
  osrdEditoastApi,
  type TrainSchedule,
  type TrainScheduleException,
  type TrainScheduleResponse,
  type PacedTrainException,
} from 'common/api/osrdEditoastApi';
import {
  unsetTrainIdsMatching,
  unsetTrainIdsMatchingMissingOccurrencesOf,
} from 'reducers/simulationResults';
import type { AppDispatch } from 'store';
import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import { getOccurrencesIds, isPacedTrainBase } from './pacedTrain';

export async function fetchTrainSchedule(
  id: number,
  dispatch: AppDispatch
): Promise<TrainScheduleResponse> {
  const trainSchedule = await dispatch(
    osrdEditoastApi.endpoints.getTrainSchedulesById.initiate(
      {
        id,
      },
      { subscribe: false }
    )
  ).unwrap();
  return trainSchedule;
}

export async function createTrainSchedules(
  dispatch: AppDispatch,
  trainScheduleSetId: number,
  trainSchedules: TrainSchedule[]
): Promise<TrainScheduleResponse[]> {
  if (!trainSchedules.length) return [];
  const newTrainSchedules = await dispatch(
    osrdEditoastApi.endpoints.postTrainScheduleSetsByIdTrainSchedules.initiate({
      id: trainScheduleSetId,
      body: trainSchedules,
    })
  ).unwrap();
  return newTrainSchedules;
}

async function updateTrainSchedule(
  dispatch: AppDispatch,
  id: number,
  trainSchedule: TrainSchedule
) {
  if (trainSchedule.paced?.exceptions && trainSchedule.paced.exceptions.length > 0) {
    console.error(
      'updateTrainSchedule: exceptions should not be included in the paced field. Use exception endpoints instead.'
    );
  }
  await dispatch(
    osrdEditoastApi.endpoints.putTrainSchedulesById.initiate({
      id,
      trainSchedule,
    })
  ).unwrap();
}

export async function createExceptions(
  dispatch: AppDispatch,
  exceptions: PacedTrainException[],
  pacedTrainId: number,
  timetableId: number
): Promise<TrainScheduleException[]> {
  // TODO: use batch when it will be possible to batch post exceptions
  return await Promise.all(
    exceptions.map((exception) => {
      // TODO_EXCEPTION: remove key from the model and this destructuration when it will be done
      const { key: _key, occurrence_index, disabled, ...change_groups } = exception;
      return dispatch(
        osrdEditoastApi.endpoints.postTimetableByIdTrainScheduleException.initiate({
          id: timetableId,
          body: {
            change_groups,
            disabled: disabled ?? false,
            occurrence_index,
            train_schedule_id: pacedTrainId,
          },
        })
      ).unwrap();
    })
  );
}

export async function updateExceptions(
  dispatch: AppDispatch,
  exceptions: PacedTrainException[],
  pacedTrainId: number
) {
  // TODO: use batch when it will be possible to batch put exceptions
  await Promise.all(
    exceptions.map((exception) => {
      const { key: _key, occurrence_index, disabled, id, ...change_groups } = exception;

      return dispatch(
        osrdEditoastApi.endpoints.putTrainScheduleExceptionById.initiate({
          // TODO_EXCEPTION: remove `!` when using TrainScheduleException type
          id: id!,
          body: {
            change_groups,
            disabled: disabled ?? false,
            occurrence_index,
            train_schedule_id: pacedTrainId,
          },
        })
      ).unwrap();
    })
  );
}

export async function deleteTrainSchedules(dispatch: AppDispatch, ids: number[]) {
  ids.forEach((id) => dispatch(unsetTrainIdsMatching(formatEditoastIdToTrainScheduleId(id))));
  await dispatch(
    osrdEditoastApi.endpoints.deleteTrainSchedules.initiate({
      body: { ids },
    })
  ).unwrap();
}

export async function deleteExceptions(dispatch: AppDispatch, ids: number[]) {
  await dispatch(
    osrdEditoastApi.endpoints.postTrainScheduleExceptionsDelete.initiate({
      body: { ids },
    })
  ).unwrap();
}

/**
 * Creates, updates, or deletes a single occurrence exception based on the generated diff.
 * Returns the final exception for local state update via updatePacedTrainExceptionsList.
 */
export async function syncOccurrenceException(
  dispatch: AppDispatch,
  generatedException: Omit<PacedTrainException, 'key' | 'occurrence_index'>,
  existingException: PacedTrainException | undefined,
  occurrenceIndex: number | undefined,
  pacedTrainId: number,
  timetableId: number
): Promise<PacedTrainException> {
  if (existingException) {
    if (isEmpty(generatedException) && !existingException.disabled) {
      // No changes vs paced train anymore — delete the exception
      // TODO_EXCEPTION: remove `!` when using TrainScheduleException type
      await deleteExceptions(dispatch, [existingException.id!]);
      // Return the empty exception so updatePacedTrainExceptionsList removes it from local state
      return {
        ...generatedException,
        // TODO_EXCEPTION: remove this when key is dropped from the model
        key: '',
        occurrence_index: occurrenceIndex,
      };
    }
    const toUpdate: PacedTrainException = {
      ...generatedException,
      id: existingException.id,
      // TODO_EXCEPTION: remove this when key is dropped from the model
      key: '',
      occurrence_index: occurrenceIndex,
    };
    await updateExceptions(dispatch, [toUpdate], pacedTrainId);
    return toUpdate;
  }

  const exceptionToCreate: PacedTrainException = {
    ...generatedException,
    // TODO_EXCEPTION: remove this when key is dropped from the model
    key: '',
    occurrence_index: occurrenceIndex,
  };
  const [created] = await createExceptions(
    dispatch,
    [exceptionToCreate],
    pacedTrainId,
    timetableId
  );
  return { ...exceptionToCreate, id: created.id };
}

export async function syncAndUpdateTrainSchedule(
  trainScheduleIdToUpdate: number,
  trainSchedule: Omit<TrainScheduleResponse, 'id'>,
  dispatch: AppDispatch
): Promise<TrainScheduleResponse> {
  if (isPacedTrainBase(trainSchedule)) {
    const trainScheduleId = formatEditoastIdToTrainScheduleId(trainScheduleIdToUpdate);
    dispatch(
      unsetTrainIdsMatchingMissingOccurrencesOf({
        trainScheduleId,
        occurrencesPresent: getOccurrencesIds(trainSchedule, trainScheduleId),
      })
    );
  }

  // Remove train_schedule_set_id before updating train schedule as we don't want to pass it in the payload
  const { train_schedule_set_id: _trainScheduleSetId, ...trainScheduleWithoutTrainScheduleSetId } =
    trainSchedule;

  // Strip exceptions from the paced field before sending to the API
  // Exceptions have their own dedicated endpoints and should not be included in the train schedule payload
  const trainSchedulePayload: TrainSchedule = trainScheduleWithoutTrainScheduleSetId.paced
    ? {
        ...trainScheduleWithoutTrainScheduleSetId,
        paced: { ...trainScheduleWithoutTrainScheduleSetId.paced, exceptions: [] },
      }
    : trainScheduleWithoutTrainScheduleSetId;

  await updateTrainSchedule(dispatch, trainScheduleIdToUpdate, trainSchedulePayload);

  return { ...trainSchedule, id: trainScheduleIdToUpdate };
}

export async function storeTrainSchedule(
  trainScheduleIdToUpdate: number,
  trainSchedule: Omit<TrainScheduleResponse, 'id'>,
  dispatch: AppDispatch,
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void
): Promise<TrainScheduleResponse> {
  const updatedPacedTrain = await syncAndUpdateTrainSchedule(
    trainScheduleIdToUpdate,
    trainSchedule,
    dispatch
  );
  upsertTrainSchedules([updatedPacedTrain]);

  return updatedPacedTrain;
}
