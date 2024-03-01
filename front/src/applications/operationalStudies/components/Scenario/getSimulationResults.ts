import i18n from 'i18next';
import { differenceBy } from 'lodash';

import {
  type SimulationReport,
  type TrainScheduleSummary,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import {
  updateAllowancesSettings,
  updateIsUpdating,
  updateSelectedProjection,
  updateSelectedTrainId,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';
import type { AllowancesSettings, Projection } from 'reducers/osrdsimulation/types';
import { store } from 'store';
import { castErrorToFailure } from 'utils/error';

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

/**
 * - If first load of the scenario, get all timetable trains results and update the simulation.
 * - If adding/updating train(s), get these train results and update the simulation.
 * - If deleting train(s) and there are still trains in the timetable, do nothing
 */
export default async function getSimulationResults(
  trainSchedulesIDs: number[],
  selectedProjection: Projection,
  allowancesSettings?: AllowancesSettings,
  simulation?: SimulationReport[]
) {
  if (trainSchedulesIDs.length > 0) {
    store.dispatch(updateIsUpdating(true));
    try {
      // We only want to display the valid trains simulations
      let { simulations: simulationLocal } = await store
        .dispatch(
          osrdEditoastApi.endpoints.postTrainScheduleResults.initiate({
            body: {
              path_id: selectedProjection.path,
              train_ids: trainSchedulesIDs,
            },
          })
        )
        .unwrap();

      // Means that we are adding or updating a train and we need to add it in the present simulation
      if (simulation) {
        const unaffectedTrains = differenceBy(simulation, simulationLocal, 'id');
        simulationLocal = unaffectedTrains.concat(simulationLocal);
      }

      const sortedSimulationLocal = [...simulationLocal].sort(
        (a: SimulationReport, b: SimulationReport) => a.base.stops[0].time - b.base.stops[0].time
      );
      store.dispatch(updateSimulation({ trains: sortedSimulationLocal }));

      // Create margins settings for each train if not set
      const newAllowancesSettings = { ...(allowancesSettings || {}) };
      sortedSimulationLocal.forEach((train) => {
        if (!newAllowancesSettings[train.id]) {
          newAllowancesSettings[train.id] = {
            base: true,
            baseBlocks: true,
            eco: true,
            ecoBlocks: false,
          };
        }
      });
      store.dispatch(updateAllowancesSettings(newAllowancesSettings));
    } catch (e) {
      store.dispatch(
        setFailure(
          castErrorToFailure(e, {
            name: i18n.t('simulation:errorMessages.unableToRetrieveTrainSchedule'),
          })
        )
      );
    } finally {
      store.dispatch(updateIsUpdating(false));
    }
  } else if (!simulation) {
    store.dispatch(updateSimulation({ trains: [] }));
    store.dispatch(updateSelectedTrainId(undefined));
    store.dispatch(updateSelectedProjection(undefined));
  }
}
