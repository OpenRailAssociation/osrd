import { osrdEditoastApi, type TrainSchedule, type PacedTrain } from 'common/api/osrdEditoastApi';
import type {
  PacedTrainId,
  PacedTrainWithPacedTrainId,
  TimetableItemId,
  TimetableItem,
  TrainScheduleId,
  TrainScheduleWithTrainId,
} from 'reducers/osrdconf/types';
import {
  unsetTrainIdsMatching,
  unsetTrainIdsMatchingMissingOccurencesOf,
} from 'reducers/simulationResults';
import type { AppDispatch } from 'store';
import {
  extractEditoastIdFromPacedTrainId,
  formatEditoastIdToTrainScheduleId,
  extractEditoastIdFromTrainScheduleId,
  formatEditoastIdToPacedTrainId,
  isPacedTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

import { getOcurrencesIds } from './pacedTrain';

export async function fetchTimetableItem(
  timetableItemId: TimetableItemId,
  dispatch: AppDispatch
): Promise<TimetableItem> {
  if (isPacedTrainId(timetableItemId)) {
    const pacedTrain = await dispatch(
      osrdEditoastApi.endpoints.getPacedTrainById.initiate(
        {
          id: extractEditoastIdFromPacedTrainId(timetableItemId),
        },
        { subscribe: false }
      )
    ).unwrap();
    return { ...pacedTrain, id: timetableItemId };
  }
  const trainSchedule = await dispatch(
    osrdEditoastApi.endpoints.getTrainScheduleById.initiate(
      {
        id: extractEditoastIdFromTrainScheduleId(timetableItemId),
      },
      { subscribe: false }
    )
  ).unwrap();
  return { ...trainSchedule, id: timetableItemId };
}

export async function createTrainSchedule(
  dispatch: AppDispatch,
  timetableId: number,
  trainSchedule: TrainSchedule
): Promise<TrainScheduleWithTrainId> {
  const newTrainSchedules = await dispatch(
    osrdEditoastApi.endpoints.postTimetableByIdTrainSchedules.initiate({
      id: timetableId,
      body: [trainSchedule],
    })
  ).unwrap();
  return {
    ...newTrainSchedules[0],
    id: formatEditoastIdToTrainScheduleId(newTrainSchedules[0].id),
  };
}

export async function createPacedTrain(
  dispatch: AppDispatch,
  timetableId: number,
  pacedTrain: PacedTrain
): Promise<PacedTrainWithPacedTrainId> {
  const newPacedTrains = await dispatch(
    osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.initiate({
      id: timetableId,
      body: [pacedTrain],
    })
  ).unwrap();
  return { ...newPacedTrains[0], id: formatEditoastIdToPacedTrainId(newPacedTrains[0].id) };
}

async function updateTrainSchedule(
  dispatch: AppDispatch,
  id: TrainScheduleId,
  trainSchedule: TrainSchedule
) {
  await dispatch(
    osrdEditoastApi.endpoints.putTrainScheduleById.initiate({
      id: extractEditoastIdFromTrainScheduleId(id),
      trainScheduleForm: trainSchedule,
    })
  ).unwrap();
}

async function updatePacedTrain(dispatch: AppDispatch, id: PacedTrainId, pacedTrain: PacedTrain) {
  await dispatch(
    osrdEditoastApi.endpoints.putPacedTrainById.initiate({
      id: extractEditoastIdFromPacedTrainId(id),
      body: pacedTrain,
    })
  ).unwrap();
}

export async function deleteTrainSchedules(dispatch: AppDispatch, ids: TrainScheduleId[]) {
  ids.forEach((id) => dispatch(unsetTrainIdsMatching(id)));
  await dispatch(
    osrdEditoastApi.endpoints.deleteTrainSchedule.initiate({
      body: { ids: ids.map((id) => extractEditoastIdFromTrainScheduleId(id)) },
    })
  ).unwrap();
}

export async function deletePacedTrains(dispatch: AppDispatch, ids: PacedTrainId[]) {
  ids.forEach((id) => dispatch(unsetTrainIdsMatching(id)));
  await dispatch(
    osrdEditoastApi.endpoints.deletePacedTrain.initiate({
      body: { ids: ids.map((id) => extractEditoastIdFromPacedTrainId(id)) },
    })
  ).unwrap();
}

export async function storeTrainSchedule(
  timetableItemIdToUpdate: TimetableItemId,
  trainSchedule: TrainSchedule,
  timetableId: number,
  dispatch: AppDispatch,
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void,
  removeTimetableItems: (timetableItems: TimetableItemId[]) => void
): Promise<TrainScheduleWithTrainId> {
  if (isTrainScheduleId(timetableItemIdToUpdate)) {
    await updateTrainSchedule(dispatch, timetableItemIdToUpdate, trainSchedule);
    const updatedTrainSchedule = {
      ...trainSchedule,
      id: timetableItemIdToUpdate,
      timetable_id: timetableId,
    };
    upsertTimetableItems([updatedTrainSchedule]);
    return updatedTrainSchedule;
  }

  // Turn a PacedTrain into a TrainSchedule
  await deletePacedTrains(dispatch, [timetableItemIdToUpdate]);
  const newTrainSchedule = await createTrainSchedule(dispatch, timetableId, trainSchedule);

  removeTimetableItems([timetableItemIdToUpdate]);
  upsertTimetableItems([newTrainSchedule]);
  return newTrainSchedule;
}

export async function storePacedTrain(
  timetableItemIdToUpdate: TimetableItemId,
  pacedTrain: PacedTrain,
  timetableId: number,
  dispatch: AppDispatch,
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void,
  removeTimetableItems: (timetableItems: TimetableItemId[]) => void
): Promise<PacedTrainWithPacedTrainId> {
  if (isPacedTrainId(timetableItemIdToUpdate)) {
    dispatch(
      unsetTrainIdsMatchingMissingOccurencesOf({
        pacedTrainId: timetableItemIdToUpdate,
        occurrencesPresent: getOcurrencesIds(pacedTrain, timetableItemIdToUpdate),
      })
    );
    await updatePacedTrain(dispatch, timetableItemIdToUpdate, pacedTrain);
    const updatedPacedTrain = {
      ...pacedTrain,
      id: timetableItemIdToUpdate,
      timetable_id: timetableId,
    };
    upsertTimetableItems([updatedPacedTrain]);
    return updatedPacedTrain;
  }

  // Turn a TrainSchedule into a PacedTrain
  await deleteTrainSchedules(dispatch, [timetableItemIdToUpdate]);
  const newPacedTrain = await createPacedTrain(dispatch, timetableId, pacedTrain);

  removeTimetableItems([timetableItemIdToUpdate]);
  upsertTimetableItems([newPacedTrain]);
  return newPacedTrain;
}
