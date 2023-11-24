import {
  updateLabels,
  updateRollingStockID,
  updateSpeedLimitByTag,
  updateAllowances,
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
  updatePowerRestrictionRanges,
} from 'reducers/osrdconf';
import { sec2time } from 'utils/timeManipulation';
import { Dispatch } from 'redux';
import { store } from 'Store';
import { Allowance, Path, TrainSchedule } from 'common/api/osrdEditoastApi';
import { ArrayElement } from 'utils/types';
import { PointOnMap } from 'applications/operationalStudies/consts';
import { compact } from 'lodash';
import { ms2kmh } from 'utils/physics';

function convertStepToPointOnMap(step?: ArrayElement<Path['steps']>): PointOnMap | undefined {
  return step
    ? {
        ...step,
        id: step.location.track_section,
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
  if (trainSchedule.rolling_stock_id)
    dispatch(updateRollingStockID(trainSchedule.rolling_stock_id));
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
  dispatch(updateInitialSpeed(ms2kmh(trainSchedule.initial_speed) || 0));

  if (trainSchedule.allowances) dispatch(updateAllowances(trainSchedule.allowances as Allowance[]));

  if (path.steps && path.steps.length > 1) {
    dispatch(updatePathfindingID(trainSchedule.path_id));
    dispatch(updateItinerary(path));
    dispatch(updateOrigin(convertStepToPointOnMap(path.steps[0])));
    dispatch(updateDestination(convertStepToPointOnMap(path.steps.at(-1))));
    if (path.steps.length > 2) {
      const vias = path.steps
        .filter(
          (via, idx) => idx !== 0 && path.steps && idx < path.steps.length - 1 && !via.suggestion
        )
        .map((via) => convertStepToPointOnMap(via));
      dispatch(replaceVias(compact(vias)));
      dispatch(updateSuggeredVias(compact(path.steps.map((via) => convertStepToPointOnMap(via)))));
    } else {
      dispatch(replaceVias([]));
    }
  }

  if (trainSchedule.allowances) dispatch(updateAllowances(trainSchedule.allowances));

  if (trainSchedule.power_restriction_ranges) {
    // TODO: refacto this when using the new train_schedule endpoints
    dispatch(
      updatePowerRestrictionRanges(
        trainSchedule.power_restriction_ranges.map((powerRestrictionRange) => ({
          begin: powerRestrictionRange.begin_position as number,
          end: powerRestrictionRange.end_position as number,
          value: powerRestrictionRange.power_restriction_code as string,
        }))
      )
    );
  }
}
