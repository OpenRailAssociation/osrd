/* eslint-disable import/prefer-default-export */
import { type TrainScheduleSummary } from 'common/api/osrdEditoastApi';
import { updateSelectedProjection, updateSelectedTrainId } from 'reducers/osrdsimulation/actions';
import type { Projection } from 'reducers/osrdsimulation/types';
import { store } from 'store';

export function selectProjection(
  trainSchedules: TrainScheduleSummary[],
  currentProjection?: Projection,
  selectedTrainId?: number
) {
  if (trainSchedules.length === 0) return;

  if (selectedTrainId && !currentProjection) {
    // if a selected train is given, we use it for the projection
    const selectedTrain = trainSchedules.find((train) => train.id === selectedTrainId);
    if (selectedTrain) {
      store.dispatch(
        updateSelectedProjection({
          id: selectedTrainId,
          path: selectedTrain.path_id,
        })
      );
      return;
    }
  }

  // if there is already a projection
  if (currentProjection) {
    const trainSchedulesIds = trainSchedules.map((train) => train.id);

    // if the projected train still exists, keep it
    if (trainSchedulesIds.includes(currentProjection.id)) {
      if (!selectedTrainId) store.dispatch(updateSelectedTrainId(trainSchedules[0].id));
      return;
    }

    // if the projected train has been deleted but an other train has the same path,
    // keep the path and select this train
    const newProjectedTrain = trainSchedules.find(
      (train) => train.path_id === currentProjection.path
    );
    if (newProjectedTrain) {
      store.dispatch(
        updateSelectedProjection({
          id: newProjectedTrain.id,
          path: currentProjection.path,
        })
      );
      store.dispatch(updateSelectedTrainId(newProjectedTrain.id));
      return;
    }
  }

  // by default, use the first train
  const sortedTrainSchedules = [...trainSchedules].sort(
    (trainA, trainB) => trainA.departure_time - trainB.departure_time
  );
  store.dispatch(
    updateSelectedProjection({
      id: sortedTrainSchedules[0].id,
      path: sortedTrainSchedules[0].path_id,
    })
  );
  store.dispatch(updateSelectedTrainId(sortedTrainSchedules[0].id));
}
