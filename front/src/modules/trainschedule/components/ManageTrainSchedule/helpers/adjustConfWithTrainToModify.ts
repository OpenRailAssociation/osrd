/* eslint-disable import/prefer-default-export */
import type { Dispatch } from 'redux';

import type { TrainScheduleResult } from 'common/api/osrdEditoastApi';
import type { OperationalStudiesConfSliceActions } from 'reducers/osrdconf/operationalStudiesConf';
import type { PathStep } from 'reducers/osrdconf/types';
import { convertIsoUtcToLocalTime } from 'utils/date';
import { msToKmh } from 'utils/physics';

export function adjustConfWithTrainToModify(
  trainSchedule: TrainScheduleResult,
  pathSteps: (PathStep | null)[],
  rollingStockId: number | undefined,
  dispatch: Dispatch,
  usingElectricalProfiles: boolean,
  osrdActions: OperationalStudiesConfSliceActions
) {
  const {
    updateRollingStockID,
    toggleUsingElectricalProfiles,
    updateSpeedLimitByTag,
    updateLabels,
    updateName,
    updateStartTime,
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
  dispatch(updateStartTime(convertIsoUtcToLocalTime(start_time)));
  dispatch(updatePathSteps({ pathSteps, resetPowerRestrictions: true }));
  const convertedInitialSpeed = initial_speed ? Math.floor(msToKmh(initial_speed) * 10) / 10 : 0;
  dispatch(updateInitialSpeed(convertedInitialSpeed));

  const trainUsingElectricalProfiles = options?.use_electrical_profiles ?? true;
  if (trainUsingElectricalProfiles !== usingElectricalProfiles)
    dispatch(toggleUsingElectricalProfiles());

  dispatch(updateSpeedLimitByTag(speed_limit_tag));

  dispatch(updateLabels(labels || []));

  dispatch(updatePowerRestrictionRanges(power_restrictions || []));
}
