import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';

import type { ValidConfig } from '../types';

export default function formatTrainSchedulePayload(
  validConfig: ValidConfig,
  trainName: string,
  startTime: Date
): TrainScheduleBase {
  const {
    constraintDistribution,
    rollingStockName,
    path,
    labels,
    speedLimitByTag,
    initialSpeed,
    usingElectricalProfiles,
    usingSpeedLimits,
    rollingStockComfort,
    margins,
    powerRestrictions,
  } = validConfig;

  return {
    comfort: rollingStockComfort,
    constraint_distribution: constraintDistribution,
    initial_speed: initialSpeed,
    labels,
    margins,
    options: {
      use_electrical_profiles: usingElectricalProfiles,
      use_speed_limits_for_simulation: usingSpeedLimits,
    },
    path,
    power_restrictions: powerRestrictions,
    rolling_stock_name: rollingStockName,
    schedule: validConfig.schedule,
    speed_limit_tag: speedLimitByTag,
    start_time: startTime.toISOString(),
    train_name: trainName,
  };
}
