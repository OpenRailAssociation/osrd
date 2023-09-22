import {
  updateAllowancesSettings,
  updateIsUpdating,
  updateSelectedProjection,
  updateSelectedTrainId,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';
import { setFailure } from 'reducers/main';
import { store } from 'Store';
import i18n from 'i18next';
import {
  SimulationReport,
  TimetableWithSchedulesDetails,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { Train } from 'reducers/osrdsimulation/types';
import { ApiError } from 'common/api/emptyApi';
import { SerializedError } from '@reduxjs/toolkit';

/**
 * Recover the time table for all the trains
 */

export default async function getSimulationResults(
  timetable: TimetableWithSchedulesDetails,
  selectedTrainId?: number
) {
  const { selectedProjection, allowancesSettings } = store.getState().osrdsimulation;
  store.dispatch(updateIsUpdating(true));
  const trainSchedulesIDs = timetable.train_schedule_summaries.map((train) => train.id);

  if (trainSchedulesIDs && trainSchedulesIDs.length > 0) {
    if (!selectedTrainId || !trainSchedulesIDs.includes(selectedTrainId)) {
      store.dispatch(updateSelectedTrainId(trainSchedulesIDs[0]));
    }

    let selectedProjectionPath: number;
    if (!selectedProjection) {
      const tempSelectedProjection = {
        id: timetable.train_schedule_summaries[0].id,
        path: timetable.train_schedule_summaries[0].path_id,
      };
      store.dispatch(updateSelectedProjection(tempSelectedProjection));
      selectedProjectionPath = tempSelectedProjection.path;
    } else {
      selectedProjectionPath = selectedProjection.path;
    }

    // We use this syntax first because of the .initiate, to be able to unsubscribe from the results later
    const results = store.dispatch(
      osrdEditoastApi.endpoints.getTrainScheduleResults.initiate({
        timetableId: timetable.id,
        pathId: selectedProjectionPath,
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
      const newAllowancesSettings = { ...allowancesSettings };
      sortedSimulationLocal.forEach((train: Train) => {
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
          message: `${
            (getTrainScheduleResultsError as ApiError)?.data?.message ||
            (getTrainScheduleResultsError as SerializedError)?.message
          }`,
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
