import {
  updateAllowancesSettings,
  updateIsUpdating,
  updateSelectedProjection,
  updateSelectedTrain,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';
import {
  trainscheduleURI,
  timetableURI,
} from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import { get } from 'common/requests';
import { setFailure } from 'reducers/main';
import { store } from 'Store';
import i18n from 'i18next';

/**
 * Recover the time table for all the trains
 */

export default async function getTimetable(givenTimetableID) {
  const timetableID = givenTimetableID || store.getState().osrdconf.timetableID;

  const { selectedProjection, allowancesSettings, displaySimulation } =
    store.getState().osrdsimulation;
  try {
    store.dispatch(updateIsUpdating(true));
    if (displaySimulation) {
      store.dispatch(updateSelectedTrain(0));
    }
    const timetable = await get(`${timetableURI}${timetableID}/`);
    const trainSchedulesIDs = timetable.train_schedules.map((train) => train.id);

    if (trainSchedulesIDs && trainSchedulesIDs.length > 0) {
      let selectedProjectionPath;
      if (!selectedProjection) {
        const tempSelectedProjection = await get(`${trainscheduleURI}${trainSchedulesIDs[0]}/`);
        store.dispatch(updateSelectedProjection(tempSelectedProjection));
        selectedProjectionPath = tempSelectedProjection.path;
      } else if (selectedProjection) {
        selectedProjectionPath = selectedProjection.path;
      }

      const simulationLocal = await get(`${trainscheduleURI}results/`, {
        params: {
          train_ids: trainSchedulesIDs.join(','),
          path: selectedProjectionPath,
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
