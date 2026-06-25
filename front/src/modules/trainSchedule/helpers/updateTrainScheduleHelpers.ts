import { isEmpty } from 'lodash';

import {
  osrdEditoastApi,
  type TrainSchedule,
  type TrainScheduleException,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import {
  unsetTrainIdsMatching,
  unsetTrainIdsMatchingMissingOccurrencesOf,
} from 'reducers/simulationResults';
import type { AppDispatch } from 'store';
import { formatEditoastIdToPacedTrainId } from 'utils/trainId';

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

export async function createPacedTrains(
  dispatch: AppDispatch,
  trainScheduleSetId: number,
  pacedTrains: TrainSchedule[]
): Promise<TrainScheduleResponse[]> {
  if (!pacedTrains.length) return [];
  const newPacedTrains = await dispatch(
    osrdEditoastApi.endpoints.postTrainScheduleSetsByIdTrainSchedules.initiate({
      id: trainScheduleSetId,
      body: pacedTrains,
    })
  ).unwrap();
  return newPacedTrains;
}

async function updatePacedTrain(dispatch: AppDispatch, id: number, trainSchedule: TrainSchedule) {
  if (trainSchedule.paced?.exceptions && trainSchedule.paced.exceptions.length > 0) {
    console.error(
      'updatePacedTrain: exceptions should not be included in the paced field. Use exception endpoints instead.'
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
  exceptions: Pick<TrainScheduleException, 'change_groups' | 'disabled' | 'occurrence_index'>[],
  pacedTrainId: number,
  timetableId: number
): Promise<TrainScheduleException[]> {
  // TODO: use batch when it will be possible to batch post exceptions
  return await Promise.all(
    exceptions.map(({ occurrence_index, disabled, change_groups }) =>
      dispatch(
        osrdEditoastApi.endpoints.postTimetableByIdTrainScheduleException.initiate({
          id: timetableId,
          body: {
            change_groups,
            disabled,
            occurrence_index,
            train_schedule_id: pacedTrainId,
          },
        })
      ).unwrap()
    )
  );
}

export async function updateExceptions(
  dispatch: AppDispatch,
  exceptions: TrainScheduleException[],
  pacedTrainId: number
) {
  // TODO: use batch when it will be possible to batch put exceptions
  await Promise.all(
    exceptions.map(({ occurrence_index, disabled, id, change_groups }) =>
      dispatch(
        osrdEditoastApi.endpoints.putTrainScheduleExceptionById.initiate({
          id,
          body: {
            change_groups,
            disabled,
            occurrence_index,
            train_schedule_id: pacedTrainId,
          },
        })
      ).unwrap()
    )
  );
}

export async function deleteTrainSchedules(dispatch: AppDispatch, ids: number[]) {
  ids.forEach((id) => dispatch(unsetTrainIdsMatching(formatEditoastIdToPacedTrainId(id))));
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
  generatedException: Omit<TrainScheduleException, 'occurrence_index'>,
  existingException: TrainScheduleException | undefined,
  occurrenceIndex: number | undefined,
  pacedTrainId: number,
  timetableId: number
): Promise<TrainScheduleException> {
  if (existingException) {
    if (isEmpty(generatedException) && !existingException.disabled) {
      // No changes vs paced train anymore — delete the exception
      await deleteExceptions(dispatch, [existingException.id]);
      // Return the empty exception so updatePacedTrainExceptionsList removes it from local state
      return {
        ...generatedException,
        occurrence_index: occurrenceIndex,
      };
    }
    const toUpdate: TrainScheduleException = {
      ...generatedException,
      id: existingException.id,
      timetable_id: existingException.timetable_id,
      train_schedule_id: existingException.train_schedule_id,
      disabled: existingException.disabled,
      occurrence_index: occurrenceIndex,
    };
    await updateExceptions(dispatch, [toUpdate], pacedTrainId);
    return toUpdate;
  }

  const exceptionToCreate: TrainScheduleException = {
    ...generatedException,
    occurrence_index: occurrenceIndex,
  };
  const [created] = await createExceptions(
    dispatch,
    [exceptionToCreate],
    pacedTrainId,
    timetableId
  );
  return created;
}

export async function syncAndUpdatePacedTrain(
  trainScheduleIdToUpdate: number,
  pacedTrain: Omit<TrainScheduleResponse, 'id'>,
  dispatch: AppDispatch
): Promise<TrainScheduleResponse> {
  if (isPacedTrainBase(pacedTrain)) {
    const pacedTrainId = formatEditoastIdToPacedTrainId(trainScheduleIdToUpdate);
    dispatch(
      unsetTrainIdsMatchingMissingOccurrencesOf({
        pacedTrainId,
        occurrencesPresent: getOccurrencesIds(pacedTrain, pacedTrainId),
      })
    );
  }

  // Remove train_schedule_set_id before updating paced train as we don't want to pass it in the payload
  const { train_schedule_set_id: _trainScheduleSetId, ...pacedTrainWithoutTrainScheduleSetId } =
    pacedTrain;

  // Strip exceptions from the paced field before sending to the API
  // Exceptions have their own dedicated endpoints and should not be included in the train schedule payload
  const trainSchedulePayload: TrainSchedule = pacedTrainWithoutTrainScheduleSetId.paced
    ? {
        ...pacedTrainWithoutTrainScheduleSetId,
        paced: { ...pacedTrainWithoutTrainScheduleSetId.paced, exceptions: [] },
      }
    : pacedTrainWithoutTrainScheduleSetId;

  await updatePacedTrain(dispatch, trainScheduleIdToUpdate, trainSchedulePayload);

  return { ...pacedTrain, id: trainScheduleIdToUpdate };
}

export async function storePacedTrain(
  trainScheduleIdToUpdate: number,
  pacedTrain: Omit<TrainScheduleResponse, 'id'>,
  dispatch: AppDispatch,
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void
): Promise<TrainScheduleResponse> {
  const updatedPacedTrain = await syncAndUpdatePacedTrain(
    trainScheduleIdToUpdate,
    pacedTrain,
    dispatch
  );
  upsertTrainSchedules([updatedPacedTrain]);

  return updatedPacedTrain;
}
