import { osrdEditoastApi, type PacedTrain } from 'common/api/osrdEditoastApi';
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
    osrdEditoastApi.endpoints.getPacedTrainById.initiate(
      {
        id,
      },
      { subscribe: false }
    )
  ).unwrap();
  return trainSchedule;
}

export async function createPacedTrain(
  dispatch: AppDispatch,
  timetableId: number,
  pacedTrain: PacedTrain
): Promise<TimetableItem> {
  const newPacedTrains = await dispatch(
    osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.initiate({
      id: timetableId,
      body: [pacedTrain],
    })
  ).unwrap();
  return newPacedTrains[0];
}

async function updatePacedTrain(dispatch: AppDispatch, id: number, pacedTrain: PacedTrain) {
  await dispatch(
    osrdEditoastApi.endpoints.putPacedTrainById.initiate({
      id,
      body: pacedTrain,
    })
  ).unwrap();
}

export async function deletePacedTrains(dispatch: AppDispatch, ids: number[]) {
  ids.forEach((id) => dispatch(unsetTrainIdsMatching(formatEditoastIdToPacedTrainId(id))));
  await dispatch(
    osrdEditoastApi.endpoints.deletePacedTrain.initiate({
      body: { ids },
    })
  ).unwrap();
}

export async function storePacedTrain(
  timetableItemIdToUpdate: number,
  pacedTrain: PacedTrain,
  timetableId: number,
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
  await updatePacedTrain(dispatch, timetableItemIdToUpdate, pacedTrain);
  const updatedPacedTrain = {
    ...pacedTrain,
    id: timetableItemIdToUpdate,
    timetable_id: timetableId,
  };
  upsertTimetableItems([updatedPacedTrain]);
  return updatedPacedTrain;
}
