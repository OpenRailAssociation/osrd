import { get, patch } from 'common/requests';
import { noop } from 'lodash';
import { trainscheduleURI } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import { updateReloadTimetable } from 'reducers/osrdsimulation/actions';

/**
 * Premare the params to override the trains details and save them
 * @param {object} simulationTrain
 * @returns
 */
export function getTrainDetailsForAPI(simulationTrain) {
  const params = {
    id: simulationTrain.id,
    departure_time: simulationTrain.base.stops[0].time,
    name: simulationTrain.base.stops[0].time,
  };
  return params;
}

/**
 * Use the trainScheduleAPI to update train details on a specific computation
 *
 * @export
 * @param {object} details
 * @param {int} id
 */
export async function changeTrain(details, id, dispatch = noop) {
  try {
    const trainDetail = await get(`${trainscheduleURI}${id}/`);
    dispatch(updateReloadTimetable(true));
    try {
      const params = {
        id,
        departure_time: details.departure_time || trainDetail.departure_time,
        initial_speed: details.initial_speed || trainDetail.initial_speed,
        labels: details.labels || trainDetail.labels,
        path: details.path || trainDetail.path,
        rolling_stock: details.rolling_stock || trainDetail.rolling_stock,
        timetable: details.timetable || trainDetail.timetable,
        train_name: details.train_name || trainDetail.train_name,
      };
      await patch(`${trainscheduleURI}${id}/`, params);
      dispatch(updateReloadTimetable(false));
    } catch (e) {
      dispatch(updateReloadTimetable(false));

      /* empty */
    }
  } catch (e) {
    /* empty */
  }
}
