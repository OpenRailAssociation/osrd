import { SerializedError } from '@reduxjs/toolkit';
import { ApiError } from 'common/api/baseGeneratedApis';
import {
  SimulationReport,
  TrainSchedule,
  TrainSchedulePatch,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { Train } from 'reducers/osrdsimulation/types';
import { Dispatch } from 'redux';
import i18next from 'i18next';

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
  train_name: simulationTrain.name,
});
// Nedded to load the namespace for i18n
i18next.loadNamespaces('operationalStudies/manageTrainSchedule');

/**
 * Use the trainScheduleAPI to update train details on a specific computation
 *
 * @export
 * @param {object} details
 * @param {int} id
 */
export const changeTrain =
  (details: Partial<TrainSchedule>, id: number) => async (dispatch: Dispatch) => {
    const {
      data: trainDetails,
      isError: isGetTrainDetailsError,
      error: getTrainDetailsError,
      isSuccess: isGetTrainDetailsSuccess,
    } = await dispatch(osrdEditoastApi.endpoints.getTrainScheduleById.initiate({ id }));

    if (isGetTrainDetailsSuccess) {
      // TODO: add the other information of the trainSchedule (allowances...)
      const trainSchedule: TrainSchedulePatch = {
        id,
        departure_time: details.departure_time || trainDetails?.departure_time,
        initial_speed: details.initial_speed || trainDetails?.initial_speed,
        labels: details.labels || trainDetails?.labels,
        path_id: details.path_id || trainDetails?.path_id,
        rolling_stock_id: details.rolling_stock_id || trainDetails?.rolling_stock_id,
        train_name: details.train_name || trainDetails?.train_name,
      };
      const response = await dispatch(
        osrdEditoastApi.endpoints.patchTrainSchedule.initiate({ body: [trainSchedule] })
      );
      if ('error' in response) {
        dispatch(
          setFailure({
            name: i18next.t(
              'operationalStudies/manageTrainSchedule:errorMessages.unableToPatchTrain'
            ),
            message: `${
              (response.error as ApiError)?.data?.message ||
              (response.error as SerializedError)?.message
            }`,
          })
        );
      }
    } else if (isGetTrainDetailsError && getTrainDetailsError) {
      dispatch(
        setFailure({
          name: i18next.t(
            'operationalStudies/manageTrainSchedule:errorMessages.unableToRetrieveTrain'
          ),
          message: `${
            (getTrainDetailsError as ApiError)?.data?.message ||
            (getTrainDetailsError as SerializedError)?.message
          }`,
        })
      );
    }
  };
