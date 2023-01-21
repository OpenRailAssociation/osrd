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
} from 'applications/operationalStudies/components/Simulation/consts';
import { get } from 'common/requests';
import { setFailure } from 'reducers/main';
import { store } from 'Store';
import i18n from 'i18next';

/**
 * Recover the time table for all the trains
 */

export default async function getTimetable() {
  const { timetableID } = store.getState().osrdconf;
  const { selectedProjection, allowancesSettings, displaySimulation } =
    store.getState().osrdsimulation;
  try {
    store.dispatch(updateIsUpdating(true));
    if (displaySimulation) {
      store.dispatch(updateSelectedTrain(0));
    }
    const timetable = await get(`${timetableURI}${timetableID}/`);
    const trainSchedulesIDs = timetable.train_schedules.map((train) => train.id);
    const tempSelectedProjection = await get(`${trainscheduleURI}${trainSchedulesIDs[0]}/`);
    if (!selectedProjection) {
      store.dispatch(updateSelectedProjection(tempSelectedProjection));
    }
    try {
      const simulationLocal = await get(`${trainscheduleURI}results/`, {
        train_ids: trainSchedulesIDs.join(','),
        path: tempSelectedProjection.path,
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
    } catch (e) {
      store.dispatch(
        setFailure({
          name: i18n.t('simulation:errorMessages.unableToRetrieveTrainSchedule'),
          message: `${e.message} `,
        })
      );
      store.dispatch(updateIsUpdating(false));
      console.log('ERROR', e);
    }
  } catch (e) {
    store.dispatch(updateIsUpdating(false));
    console.log('ERROR', e);
  }
}
