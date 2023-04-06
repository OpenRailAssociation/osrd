import {
  updateLabels,
  updateRollingStockID,
  updateSpeedLimitByTag,
  toggleUsingElectricalProfiles,
  updateName,
  updateDepartureTime,
  updateInitialSpeed,
  updatePathfindingID,
} from 'reducers/osrdconf';
import { sec2time } from 'utils/timeManipulation';
import { Dispatch } from 'redux';
import { store } from 'Store';
import { TrainSchedule } from 'common/api/osrdMiddlewareApi';

export default function ajustConf2TrainToModify(trainSchedule: TrainSchedule, dispatch: Dispatch) {
  const { osrdconf } = store.getState();
  if (trainSchedule.rolling_stock) dispatch(updateRollingStockID(trainSchedule.rolling_stock));
  if (
    trainSchedule.options?.ignore_electrical_profiles ===
    osrdconf.simulationConf.usingElectricalProfiles
  )
    dispatch(toggleUsingElectricalProfiles());

  dispatch(updateSpeedLimitByTag(trainSchedule.speed_limit_tags));
  dispatch(updateLabels(trainSchedule.labels));

  if (trainSchedule.train_name) dispatch(updateName(trainSchedule.train_name));
  if (trainSchedule.departure_time)
    dispatch(updateDepartureTime(sec2time(trainSchedule.departure_time)));
  dispatch(updateInitialSpeed(trainSchedule.initial_speed || 0));

  dispatch(updatePathfindingID(trainSchedule.path));
}
