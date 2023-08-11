import { get } from 'common/requests';
import { setFailure } from 'reducers/main';
import {
  updateAllowancesSettings,
  updateSelectedProjection,
  updateSelectedTrainId,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';

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
      dispatch(updateSelectedTrainId(undefined));
    }
    const timetable = await get(`/editoast/timetable/${timetableID}/`);
    /*
    if (timetable.train_schedules.length > 0) {
      setIsEmpty(false);
    }
    */
    const trainScheduleId = timetable.train_schedules[0].id;
    const tempSelectedProjection = await get(`/editoast/train_schedule/${trainScheduleId}/`);
    if (!selectedProjection) {
      dispatch(updateSelectedProjection(tempSelectedProjection));
    }
    try {
      const simulationLocal = await get(`/editoast/train_schedule/results/`, {
        params: {
          timetable_id: timetableID,
          path_id: tempProjectedPathId || tempSelectedProjection.path,
        },
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
    }
  } catch (e) {
    /* empty */
  }
}
