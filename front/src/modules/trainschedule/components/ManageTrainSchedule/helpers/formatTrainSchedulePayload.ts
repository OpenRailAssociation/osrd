/* eslint-disable @typescript-eslint/no-unused-vars */
import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';

import type { ValidConfig } from '../types';

export default function formatTrainSchedulePayload(
  validConfig: ValidConfig,
  trainName: string,
  startTime: string
): TrainScheduleBase {
  const {
    constraintDistribution,
    rollingStockName,
    path,
    labels,
    speedLimitByTag,
    initialSpeed,
    usingElectricalProfiles,
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
    },
    path,
    power_restrictions: powerRestrictions,
    rolling_stock_name: rollingStockName,
    schedule: validConfig.schedule,
    speed_limit_tag: speedLimitByTag,
    start_time: startTime,
    train_name: trainName,
  };
}
