import {
  osrdEditoastApi,
  type TrainScheduleBase,
  type PacedTrain,
} from 'common/api/osrdEditoastApi';
import type {
  PacedTrainId,
  TimetableItemId,
  TimetableItemWithTimetableId,
  TrainScheduleId,
} from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import {
  formatPacedTrainIdToEditoastTrainId,
  formatEditoastTrainIdToTrainScheduleId,
  formatTrainScheduleIdToEditoastTrainId,
  formatEditoastTrainIdToPacedTrainId,
  isPacedTrain,
  isTrainSchedule,
} from 'utils/trainId';

async function createTrainSchedule(
  dispatch: AppDispatch,
  timetableId: number,
  trainSchedule: TrainScheduleBase
): Promise<TimetableItemWithTimetableId> {
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
): Promise<TimetableItemWithTimetableId> {
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
  trainSchedule: TrainScheduleBase
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

export async function storeTrainSchedule(
  timetableItemIdToUpdate: TimetableItemId,
  trainSchedule: TrainScheduleBase,
  timetableId: number,
  dispatch: AppDispatch,
  upsertTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void,
  removeTimetableItems: (timetableItems: TimetableItemId[]) => void
): Promise<TimetableItemWithTimetableId> {
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
  await dispatch(
    osrdEditoastApi.endpoints.deletePacedTrain.initiate({
      body: { ids: [formatPacedTrainIdToEditoastTrainId(timetableItemIdToUpdate)] },
    })
  );
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
): Promise<TimetableItemWithTimetableId> {
  if (isPacedTrain(timetableItemIdToUpdate)) {
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
  await dispatch(
    osrdEditoastApi.endpoints.deleteTrainSchedule.initiate({
      body: { ids: [formatTrainScheduleIdToEditoastTrainId(timetableItemIdToUpdate)] },
    })
  );
  const newPacedTrain = await createPacedTrain(dispatch, timetableId, pacedTrain);
  removeTimetableItems([timetableItemIdToUpdate]);
  upsertTimetableItems([newPacedTrain]);
  return newPacedTrain;
}
