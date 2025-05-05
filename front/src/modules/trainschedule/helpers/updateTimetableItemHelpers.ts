import { osrdEditoastApi, type TrainSchedule, type PacedTrain } from 'common/api/osrdEditoastApi';
import type {
  PacedTrainId,
  PacedTrainResponseWithPacedTrainId,
  TimetableItemId,
  TimetableItemWithTimetableId,
  TrainScheduleId,
  TrainScheduleResponseWithTrainId,
} from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import {
  formatPacedTrainIdToEditoastTrainId,
  formatEditoastTrainIdToTrainScheduleId,
  formatTrainScheduleIdToEditoastTrainId,
  formatEditoastTrainIdToPacedTrainId,
  isPacedTrainId,
  isTrainSchedule,
} from 'utils/trainId';

export async function fetchTimetableItem(
  timetableItemId: TimetableItemId,
  dispatch: AppDispatch
): Promise<TimetableItemWithTimetableId> {
  if (isPacedTrainId(timetableItemId)) {
    const pacedTrain = await dispatch(
      osrdEditoastApi.endpoints.getPacedTrainById.initiate(
        {
          id: formatPacedTrainIdToEditoastTrainId(timetableItemId),
        },
        { subscribe: false }
      )
    ).unwrap();
    return { ...pacedTrain, id: timetableItemId };
  }
  const trainSchedule = await dispatch(
    osrdEditoastApi.endpoints.getTrainScheduleById.initiate(
      {
        id: formatTrainScheduleIdToEditoastTrainId(timetableItemId),
      },
      { subscribe: false }
    )
  ).unwrap();
  return { ...trainSchedule, id: timetableItemId };
}

async function createTrainSchedule(
  dispatch: AppDispatch,
  timetableId: number,
  trainSchedule: TrainSchedule
): Promise<TrainScheduleResponseWithTrainId> {
  const newTrainSchedules = await dispatch(
    osrdEditoastApi.endpoints.postTimetableByIdTrainSchedules.initiate({
      id: timetableId,
      body: [trainSchedule],
    })
  ).unwrap();
  return {
    ...newTrainSchedules[0],
    id: formatEditoastTrainIdToTrainScheduleId(newTrainSchedules[0].id),
  };
}

async function createPacedTrain(
  dispatch: AppDispatch,
  timetableId: number,
  pacedTrain: PacedTrain
): Promise<PacedTrainResponseWithPacedTrainId> {
  const newPacedTrains = await dispatch(
    osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.initiate({
      id: timetableId,
      body: [pacedTrain],
    })
  ).unwrap();
  return { ...newPacedTrains[0], id: formatEditoastTrainIdToPacedTrainId(newPacedTrains[0].id) };
}

async function updateTrainSchedule(
  dispatch: AppDispatch,
  id: TrainScheduleId,
  trainSchedule: TrainSchedule
) {
  await dispatch(
    osrdEditoastApi.endpoints.putTrainScheduleById.initiate({
      id: formatTrainScheduleIdToEditoastTrainId(id),
      trainScheduleForm: trainSchedule,
    })
  ).unwrap();
}

async function updatePacedTrain(dispatch: AppDispatch, id: PacedTrainId, pacedTrain: PacedTrain) {
  await dispatch(
    osrdEditoastApi.endpoints.putPacedTrainById.initiate({
      id: formatPacedTrainIdToEditoastTrainId(id),
      body: pacedTrain,
    })
  ).unwrap();
}

async function deleteTrainSchedule(dispatch: AppDispatch, id: TrainScheduleId) {
  await dispatch(
    osrdEditoastApi.endpoints.deleteTrainSchedule.initiate({
      body: { ids: [formatTrainScheduleIdToEditoastTrainId(id)] },
    })
  ).unwrap();
}

async function deletePacedTrain(dispatch: AppDispatch, id: PacedTrainId) {
  await dispatch(
    osrdEditoastApi.endpoints.deletePacedTrain.initiate({
      body: { ids: [formatPacedTrainIdToEditoastTrainId(id)] },
    })
  ).unwrap();
}

export async function storeTrainSchedule(
  timetableItemIdToUpdate: TimetableItemId,
  trainSchedule: TrainSchedule,
  timetableId: number,
  dispatch: AppDispatch,
  upsertTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void,
  removeTimetableItems: (timetableItems: TimetableItemId[]) => void
): Promise<TrainScheduleResponseWithTrainId> {
  if (isTrainSchedule(timetableItemIdToUpdate)) {
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
  await deletePacedTrain(dispatch, timetableItemIdToUpdate);
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
  upsertTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void,
  removeTimetableItems: (timetableItems: TimetableItemId[]) => void
): Promise<PacedTrainResponseWithPacedTrainId> {
  if (isPacedTrainId(timetableItemIdToUpdate)) {
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
  await deleteTrainSchedule(dispatch, timetableItemIdToUpdate);
  const newPacedTrain = await createPacedTrain(dispatch, timetableId, pacedTrain);

  removeTimetableItems([timetableItemIdToUpdate]);
  upsertTimetableItems([newPacedTrain]);
  return newPacedTrain;
}
