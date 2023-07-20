import {
  updateAllowancesSettings,
  updateIsUpdating,
  updateSelectedProjection,
  updateSelectedTrainId,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';
import { trainscheduleURI } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import { get } from 'common/requests';
import { setFailure } from 'reducers/main';
import { store } from 'Store';
import i18n from 'i18next';

/**
 * Recover the time table for all the trains
 */

export default async function getTimetable(timetable) {
  const { selectedProjection, allowancesSettings } = store.getState().osrdsimulation;
  try {
    store.dispatch(updateIsUpdating(true));
    const trainSchedulesIDs = timetable.train_schedule_summaries.map((train) => train.id);

    if (trainSchedulesIDs && trainSchedulesIDs.length > 0) {
      store.dispatch(updateSelectedTrainId(timetable.train_schedule_summaries[0].id));
      let selectedProjectionPath;
      if (!selectedProjection) {
        const tempSelectedProjection = {
          id: timetable.train_schedule_summaries[0].id,
          path: timetable.train_schedule_summaries[0].path_id,
        };
        store.dispatch(updateSelectedProjection(tempSelectedProjection));
        selectedProjectionPath = tempSelectedProjection.path;
      } else if (selectedProjection) {
        selectedProjectionPath = selectedProjection.path;
      }
      const simulationLocal = await get(`${trainscheduleURI}results/`, {
        params: {
          timetable_id: timetable.id,
          path_id: selectedProjectionPath,
        },
      });
      simulationLocal.sort((a, b) => a.base.stops[0].time > b.base.stops[0].time);
      store.dispatch(updateSimulation({ trains: simulationLocal }));

      // Create margins settings for each train if not set
      const newAllowancesSettings = { ...allowancesSettings };
      simulationLocal.forEach((train) => {
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
    } else {
      store.dispatch(updateSimulation({ trains: [] }));
      store.dispatch(updateIsUpdating(false));
      store.dispatch(updateSelectedTrainId(undefined));
      store.dispatch(updateSelectedProjection(undefined));
    }
  } catch (e) {
    store.dispatch(
      setFailure({
        name: i18n.t('simulation:errorMessages.unableToRetrieveTrainSchedule'),
        message: `${e.message} `,
      })
    );
    store.dispatch(updateIsUpdating(false));
    console.error(e);
  }
}
