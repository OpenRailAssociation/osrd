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
  replaceVias,
  updateSuggeredVias,
} from 'reducers/osrdconf';
import { sec2time } from 'utils/timeManipulation';
import { Dispatch } from 'redux';
import { store } from 'Store';
import { Path, TrainSchedule } from 'common/api/osrdMiddlewareApi';
import { ArrayElement } from 'utils/types';

function convertStep2PointOnMap(step?: ArrayElement<Path['steps']>) {
  return step
    ? {
        ...step,
        id: step.track,
        coordinates: step.geo?.coordinates,
      }
    : undefined;
}

export default function adjustConfWithTrainToModify(
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

  if (path.steps && path.steps.length > 1) {
    dispatch(updatePathfindingID(trainSchedule.path));
    dispatch(updateItinerary(path));
    dispatch(updateOrigin(convertStep2PointOnMap(path.steps[0])));
    dispatch(updateDestination(convertStep2PointOnMap(path.steps.at(-1))));
    if (path.steps.length > 2) {
      const vias = path.steps
        .filter(
          (via, idx) => idx !== 0 && path.steps && idx < path.steps.length - 1 && !via.suggestion
        )
        .map((via) => convertStep2PointOnMap(via));
      dispatch(replaceVias(vias));
      dispatch(updateSuggeredVias(path.steps.map((via) => convertStep2PointOnMap(via))));
    } else {
      dispatch(replaceVias(undefined));
    }
  }
}
