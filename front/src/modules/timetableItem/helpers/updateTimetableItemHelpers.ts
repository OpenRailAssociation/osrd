import { osrdEditoastApi, type PacedTrain } from 'common/api/osrdEditoastApi';
import type {
  PacedTrainId,
  PacedTrainWithPacedTrainId,
  TimetableItemId,
  TimetableItem,
} from 'reducers/osrdconf/types';
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

import { getOcurrencesIds, isPacedTrainWithPaced } from './pacedTrain';

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
  throw new Error('TrainSchedules are not handled anymore.');
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

async function updatePacedTrain(dispatch: AppDispatch, id: PacedTrainId, pacedTrain: PacedTrain) {
  await dispatch(
    osrdEditoastApi.endpoints.putPacedTrainById.initiate({
      id: extractEditoastIdFromPacedTrainId(id),
      body: pacedTrain,
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

export async function storePacedTrain(
  timetableItemIdToUpdate: TimetableItemId,
  pacedTrain: PacedTrain,
  timetableId: number,
  dispatch: AppDispatch,
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void
): Promise<PacedTrainWithPacedTrainId> {
  if (isPacedTrainWithPaced(pacedTrain)) {
    dispatch(
      unsetTrainIdsMatchingMissingOccurencesOf({
        pacedTrainId: timetableItemIdToUpdate,
        occurrencesPresent: getOcurrencesIds(pacedTrain, timetableItemIdToUpdate),
      })
    );
  }
  await updatePacedTrain(dispatch, timetableItemIdToUpdate, pacedTrain);
  const updatedPacedTrain = {
    ...pacedTrain,
    id: timetableItemIdToUpdate,
    timetable_id: timetableId,
  };
  upsertTimetableItems([updatedPacedTrain]);
  return updatedPacedTrain;
}
