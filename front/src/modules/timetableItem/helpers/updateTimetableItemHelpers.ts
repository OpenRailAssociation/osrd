import {
  osrdEditoastApi,
  type TrainSchedule,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import type { TimetableItem } from 'reducers/osrdconf/types';
import {
  unsetTrainIdsMatching,
  unsetTrainIdsMatchingMissingOccurencesOf,
} from 'reducers/simulationResults';
import type { AppDispatch } from 'store';
import { formatEditoastIdToPacedTrainId } from 'utils/trainId';

import { getOcurrencesIds, isPacedTrainBase } from './pacedTrain';

export async function fetchTimetableItem(
  id: number,
  dispatch: AppDispatch
): Promise<TimetableItem> {
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
): Promise<TimetableItem[]> {
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
  await dispatch(
    osrdEditoastApi.endpoints.putTrainSchedulesById.initiate({
      id,
      trainSchedule,
    })
  ).unwrap();
}

export async function deleteTrainSchedules(dispatch: AppDispatch, ids: number[]) {
  ids.forEach((id) => dispatch(unsetTrainIdsMatching(formatEditoastIdToPacedTrainId(id))));
  await dispatch(
    osrdEditoastApi.endpoints.deleteTrainSchedules.initiate({
      body: { ids },
    })
  ).unwrap();
}

export async function storePacedTrain(
  timetableItemIdToUpdate: number,
  pacedTrain: Omit<TrainScheduleResponse, 'id'>,
  dispatch: AppDispatch,
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void
): Promise<TimetableItem> {
  if (isPacedTrainBase(pacedTrain)) {
    const pacedTrainId = formatEditoastIdToPacedTrainId(timetableItemIdToUpdate);
    dispatch(
      unsetTrainIdsMatchingMissingOccurencesOf({
        pacedTrainId,
        occurrencesPresent: getOcurrencesIds(pacedTrain, pacedTrainId),
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
