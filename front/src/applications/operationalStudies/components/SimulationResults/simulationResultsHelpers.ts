import {
  SimulationReport,
  TrainSchedule,
  TrainSchedulePatch,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { updateReloadTimetable } from 'reducers/osrdsimulation/actions';
import { Train } from 'reducers/osrdsimulation/types';
import { Dispatch } from 'redux';

/**
 * Premare the params to override the trains details and save them
 * @param {object} simulationTrain
 * @returns
 */
export const getTrainDetailsForAPI = (
  simulationTrain: SimulationReport | Train
): Partial<TrainSchedule> => ({
  id: simulationTrain.id,
  departure_time: simulationTrain.base.stops[0].time,
  train_name: simulationTrain.base.stops[0].name || simulationTrain.name,
});

/**
 * Use the trainScheduleAPI to update train details on a specific computation
 *
 * @export
 * @param {object} details
 * @param {int} id
 */
export const changeTrain =
  (details: Partial<TrainSchedule>, id: number) => async (dispatch: Dispatch) => {
    try {
      const { data: trainDetail } = await dispatch(
        osrdEditoastApi.endpoints.getTrainScheduleById.initiate({ id })
      );
      try {
        // TODO: add the other information of the trainSchedule (allowances...)
        const trainSchedule: TrainSchedulePatch = {
          id,
          departure_time: details.departure_time || trainDetail?.departure_time,
          initial_speed: details.initial_speed || trainDetail?.initial_speed,
          labels: details.labels || trainDetail?.labels,
          path_id: details.path_id || trainDetail?.path_id,
          rolling_stock_id: details.rolling_stock_id || trainDetail?.rolling_stock_id,
          train_name: details.train_name || trainDetail?.train_name,
        };
        dispatch(updateReloadTimetable(true));
        dispatch(osrdEditoastApi.endpoints.patchTrainSchedule.initiate({ body: [trainSchedule] }));
        dispatch(updateReloadTimetable(false));
      } catch (e) {
        dispatch(updateReloadTimetable(false));
        if (e instanceof Error) {
          dispatch(
            setFailure({
              name: e.name,
              message: e.message,
            })
          );
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        dispatch(
          setFailure({
            name: e.name,
            message: e.message,
          })
        );
      }
    }
  };
