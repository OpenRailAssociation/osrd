import { compact } from 'lodash';
import type { Dispatch } from 'redux';

import type { PointOnMap } from 'applications/operationalStudies/consts';
import type {
  Allowance,
  PathResponse,
  TrainSchedule,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { ConfSliceActions } from 'reducers/osrdconf/osrdConfCommon';
import type { PathStep } from 'reducers/osrdconf/types';
import { msToKmh } from 'utils/physics';
import { sec2time } from 'utils/timeManipulation';
import type { ArrayElement } from 'utils/types';

function convertStepToPointOnMap(
  step?: ArrayElement<PathResponse['steps']>
): PointOnMap | undefined {
  return step
    ? {
        ...step,
        id: step.location.track_section,
        name: step.name || undefined,
        coordinates: step.geo?.coordinates,
      }
    : undefined;
}

export function loadPathFinding(
  path: PathResponse,
  dispatch: Dispatch,
  osrdActions: ConfSliceActions
) {
  const {
    updatePathfindingID,
    updateItinerary,
    updateOrigin,
    updateDestination,
    replaceVias,
    updateSuggeredVias,
  } = osrdActions;
  if (path.steps && path.steps.length > 1) {
    dispatch(updatePathfindingID(path.id));
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
}

export default function adjustConfWithTrainToModify(
  trainSchedule: TrainSchedule,
  path: PathResponse,
  dispatch: Dispatch,
  usingElectricalProfiles: boolean,
  osrdActions: ConfSliceActions
) {
  const {
    updateRollingStockID,
    toggleUsingElectricalProfiles,
    updateSpeedLimitByTag,
    updateLabels,
    updateName,
    updateDepartureTime,
    updateInitialSpeed,
    updateAllowances,
    updatePowerRestrictionRanges,
  } = osrdActions;
  if (trainSchedule.rolling_stock_id)
    dispatch(updateRollingStockID(trainSchedule.rolling_stock_id));

  if (trainSchedule.options?.ignore_electrical_profiles === usingElectricalProfiles)
    dispatch(toggleUsingElectricalProfiles());

  dispatch(updateSpeedLimitByTag(trainSchedule.speed_limit_tags));
  dispatch(updateLabels(trainSchedule.labels));

  if (trainSchedule.train_name) dispatch(updateName(trainSchedule.train_name));

  if (trainSchedule.departure_time)
    dispatch(updateDepartureTime(sec2time(trainSchedule.departure_time)));
  dispatch(updateInitialSpeed(msToKmh(trainSchedule.initial_speed) || 0));

  if (trainSchedule.allowances) dispatch(updateAllowances(trainSchedule.allowances as Allowance[]));

  loadPathFinding(path, dispatch, osrdActions);

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

export function adjustConfWithTrainToModifyV2(
  trainSchedule: TrainScheduleResult,
  pathSteps: PathStep[],
  rollingStockId: number,
  dispatch: Dispatch,
  usingElectricalProfiles: boolean,
  osrdActions: ConfSliceActions
) {
  const {
    updateRollingStockID,
    toggleUsingElectricalProfiles,
    updateSpeedLimitByTag,
    updateLabels,
    updateName,
    updateDepartureTime,
    updateInitialSpeed,
    updatePowerRestrictionRanges,
    updatePathSteps,
  } = osrdActions;

  const {
    options,
    speed_limit_tag,
    labels,
    train_name,
    start_time,
    initial_speed,
    power_restrictions,
  } = trainSchedule;

  dispatch(updateRollingStockID(rollingStockId));
  dispatch(updateName(train_name));
  dispatch(updateDepartureTime(start_time));
  dispatch(updatePathSteps({ pathSteps, resetPowerRestrictions: true }));
  dispatch(updateInitialSpeed(initial_speed ? msToKmh(initial_speed) : 0));

  if (options?.use_electrical_profiles === usingElectricalProfiles)
    dispatch(toggleUsingElectricalProfiles());

  if (speed_limit_tag) dispatch(updateSpeedLimitByTag(speed_limit_tag));

  if (labels) dispatch(updateLabels(labels));

  if (power_restrictions) {
    // TODO TS2 : check that this format is still the one we need
    dispatch(
      updatePowerRestrictionRanges(
        power_restrictions.map(({ from, to, value }) => ({
          begin: +from,
          end: +to,
          value,
        }))
      )
    );
  }
}
