import { get } from 'common/requests';
import { setFailure } from 'reducers/main';
import {
  updateAllowancesSettings,
  updateSelectedProjection,
  updateSelectedTrain,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';
import {
  timetableURI,
  trainscheduleURI,
} from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
/**
 * Recover the time table for all the trains
 */
export default async function getStdcmTimetable(
  simulation,
  selectedTrain,
  dispatch,
  timetableID,
  allowancesSettings,
  selectedProjection,
  t,
  tempProjectedPathId
) {
  try {
    if (!simulation.trains || !simulation.trains[selectedTrain]) {
      dispatch(updateSelectedTrain(0));
    }
    const timetable = await get(`${timetableURI}${timetableID}/`);
    /*
    if (timetable.train_schedules.length > 0) {
      setIsEmpty(false);
    }
    */
    const trainSchedulesIDs = timetable.train_schedules.map((train) => train.id);
    const tempSelectedProjection = await get(`${trainscheduleURI}${trainSchedulesIDs[0]}/`);
    if (!selectedProjection) {
      dispatch(updateSelectedProjection(tempSelectedProjection));
    }
    try {
      const simulationLocal = await get(`${trainscheduleURI}results/`, {
        train_ids: trainSchedulesIDs.join(','),
        path: tempProjectedPathId || tempSelectedProjection.path,
      });
      simulationLocal.sort((a, b) => a.base.stops[0].time > b.base.stops[0].time);
      dispatch(updateSimulation({ trains: simulationLocal }));

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
      dispatch(updateAllowancesSettings(newAllowancesSettings));
    } catch (e) {
      dispatch(
        setFailure({
          name: t('simulation:errorMessages.unableToRetrieveTrainSchedule'),
          message: `${e.message} `,
        })
      );
      console.log('ERROR', e);
    }
  } catch (e) {
    console.log('ERROR', e);
  }
}
