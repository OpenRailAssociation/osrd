import {
  updateAllowancesSettings,
  updateIsUpdating,
  updateSelectedProjection,
  updateSelectedTrainId,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';
import { setFailure } from 'reducers/main';
import { store } from 'store';
import i18n from 'i18next';
import {
  SimulationReport,
  TimetableWithSchedulesDetails,
  TrainScheduleSummary,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { extractMessageFromError } from 'utils/error';
import { AllowancesSettings, Projection } from 'reducers/osrdsimulation/types';

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
 * Recover the time table for all the trains
 */
export default async function getSimulationResults(
  timetable: TimetableWithSchedulesDetails,
  selectedProjection: Projection,
  allowancesSettings?: AllowancesSettings
) {
  store.dispatch(updateIsUpdating(true));
  const trainSchedulesIDs = timetable.train_schedule_summaries.map((train) => train.id);

  if (trainSchedulesIDs.length > 0) {
    // We use this syntax first because of the .initiate, to be able to unsubscribe from the results later
    const results = store.dispatch(
      osrdEditoastApi.endpoints.getTrainScheduleResults.initiate({
        timetableId: timetable.id,
        pathId: selectedProjection.path,
      })
    );

    const {
      data: simulationLocal,
      isError: isGetTrainScheduleResultsError,
      error: getTrainScheduleResultsError,
    } = await results;

    if (simulationLocal) {
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
      store.dispatch(updateIsUpdating(false));
    } else if (isGetTrainScheduleResultsError && getTrainScheduleResultsError) {
      store.dispatch(
        setFailure({
          name: i18n.t('simulation:errorMessages.unableToRetrieveTrainSchedule'),
          message: extractMessageFromError(getTrainScheduleResultsError),
        })
      );
      store.dispatch(updateIsUpdating(false));
      console.error(getTrainScheduleResultsError);
    }

    // Manually dispatching an RTK request with .initiate will create a subscription entry, but we need to unsubscribe from that data also manually - otherwise the data stays in the cache permanently.
    results.unsubscribe();
  } else {
    store.dispatch(updateSimulation({ trains: [] }));
    store.dispatch(updateIsUpdating(false));
    store.dispatch(updateSelectedTrainId(undefined));
    store.dispatch(updateSelectedProjection(undefined));
  }
}
