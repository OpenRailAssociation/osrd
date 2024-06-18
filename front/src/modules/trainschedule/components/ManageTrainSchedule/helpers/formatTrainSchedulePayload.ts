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
    // TODO TS2 : handle power restrictions
    // power_restrictions: validConfig.powerRestrictions,
    rolling_stock_name: rollingStockName,
    // TODO TS2 : handle handle margins
    schedule: validConfig.schedule,
    speed_limit_tag: speedLimitByTag,
    start_time: startTime,
    train_name: trainName,
  };
}
