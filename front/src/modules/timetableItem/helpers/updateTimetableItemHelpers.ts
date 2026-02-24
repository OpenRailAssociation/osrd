import {
  osrdEditoastApi,
  type PacedTrainException,
  type TrainSchedule,
  type TrainScheduleException,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import type { PacedTrainId, TimetableItem, TimetableItemId } from 'reducers/osrdconf/types';
import {
  unsetTrainIdsMatching,
  unsetTrainIdsMatchingMissingOccurencesOf,
} from 'reducers/simulationResults';
import type { AppDispatch } from 'store';
import {
  extractEditoastIdFromPacedTrainId,
  formatEditoastIdToPacedTrainId,
  isPacedTrainId,
} from 'utils/trainId';

import { getOcurrencesIds, isPacedTrainBase } from './pacedTrain';

export async function fetchTimetableItem(
  timetableItemId: TimetableItemId,
  dispatch: AppDispatch
): Promise<TimetableItem> {
  if (isPacedTrainId(timetableItemId)) {
    const pacedTrain = await dispatch(
      osrdEditoastApi.endpoints.getTrainSchedulesById.initiate(
        {
          id: extractEditoastIdFromPacedTrainId(timetableItemId),
        },
        { subscribe: false }
      )
    ).unwrap();
    return { ...pacedTrain, id: timetableItemId };
  }
  throw new Error('TrainSchedules are not handled anymore.');
}

export async function createPacedTrains(
  dispatch: AppDispatch,
  trainScheduleSetId: number,
  pacedTrains: TrainSchedule[]
): Promise<TimetableItem[]> {
  if (!pacedTrains.length) return [];
  const newPacedTrains = await dispatch(
    osrdEditoastApi.endpoints.postTrainScheduleSetsByIdTrainSchedules.initiate({
      id: trainScheduleSetId,
      body: pacedTrains,
    })
  ).unwrap();
  return newPacedTrains.map((pacedTrain) => ({
    ...pacedTrain,
    id: formatEditoastIdToPacedTrainId(pacedTrain.id),
  }));
}

export async function createExceptions(
  dispatch: AppDispatch,
  exceptions: PacedTrainException[],
  pacedTrainId: PacedTrainId,
  timetableId: number
): Promise<TrainScheduleException[]> {
  // TODO: use batch when it will be possible to batch post exceptions
  return await Promise.all(
    exceptions.map((exception) => {
      const { key: _key, occurrence_index, disabled, ...change_groups } = exception;
      return dispatch(
        osrdEditoastApi.endpoints.postTimetableByIdTrainScheduleException.initiate({
          id: timetableId,
          body: {
            change_groups,
            disabled: disabled ?? false,
            occurrence_index,
            train_schedule_id: extractEditoastIdFromPacedTrainId(pacedTrainId),
          },
        })
      ).unwrap();
    })
  );
}

async function updatePacedTrain(
  dispatch: AppDispatch,
  id: PacedTrainId,
  trainSchedule: TrainSchedule
) {
  await dispatch(
    osrdEditoastApi.endpoints.putPacedTrainById.initiate({
      id: extractEditoastIdFromPacedTrainId(id),
      trainSchedule,
    })
  ).unwrap();
}

export async function deleteTrainSchedules(dispatch: AppDispatch, ids: PacedTrainId[]) {
  ids.forEach((id) => dispatch(unsetTrainIdsMatching(id)));
  await dispatch(
    osrdEditoastApi.endpoints.deleteTrainSchedules.initiate({
      body: { ids: ids.map((id) => extractEditoastIdFromPacedTrainId(id)) },
    })
  ).unwrap();
}

export async function storePacedTrain(
  timetableItemIdToUpdate: TimetableItemId,
  pacedTrain: Omit<TrainScheduleResponse, 'id'>,
  dispatch: AppDispatch,
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void
): Promise<TimetableItem> {
  if (isPacedTrainBase(pacedTrain)) {
    dispatch(
      unsetTrainIdsMatchingMissingOccurencesOf({
        pacedTrainId: timetableItemIdToUpdate,
        occurrencesPresent: getOcurrencesIds(pacedTrain, timetableItemIdToUpdate),
      })
    );
  }

  // Remove train_schedule_set_id before updating paced train as we don't want to pass it in the payload
  const { train_schedule_set_id: _trainScheduleSetId, ...pacedTrainWithoutTrainScheduleSetId } =
    pacedTrain;
  await updatePacedTrain(dispatch, timetableItemIdToUpdate, pacedTrainWithoutTrainScheduleSetId);
  const updatedPacedTrain: TimetableItem = {
    ...pacedTrain,
    id: timetableItemIdToUpdate,
  };
  upsertTimetableItems([updatedPacedTrain]);
  return updatedPacedTrain;
}
