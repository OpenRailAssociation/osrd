import {
  updateLabels,
  updateRollingStockID,
  updateSpeedLimitByTag,
  toggleUsingElectricalProfiles,
  updateName,
  updateDepartureTime,
  updateInitialSpeed,
  updatePathfindingID,
  updateItinerary,
  updateOrigin,
  updateDestination,
} from 'reducers/osrdconf';
import { sec2time } from 'utils/timeManipulation';
import { Dispatch } from 'redux';
import { store } from 'Store';
import { Path, TrainSchedule } from 'common/api/osrdMiddlewareApi';

// Râle pas Mathieu c'est temporaire !
function convertStep2PointOnMap(step: any) {
  return {
    ...step,
    id: step.track,
    extension_sncf_line_code: '',
    extension_sncf_line_name: '',
    extension_sncf_track_name: '',
    extension_sncf_track_number: '',
    loading_gauge_limits: '',
    source: 'geo',
    coordinates: step.geo.coordinates,
  };
}

export default function ajustConf2TrainToModify(
  trainSchedule: TrainSchedule,
  path: Path,
  dispatch: Dispatch
) {
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
  dispatch(updateItinerary(path));
  if (path.steps) {
    dispatch(updateOrigin(convertStep2PointOnMap(path.steps[0])));
    dispatch(updateDestination(convertStep2PointOnMap(path.steps.at(-1))));
  }
}
