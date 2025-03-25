import type { PacedTrain, TrainScheduleBase } from 'common/api/osrdEditoastApi';

import type { ValidConfig } from '../types';

export function formatTimetableItemPayload(validConfig: ValidConfig): TrainScheduleBase {
  return {
    comfort: validConfig.rollingStockComfort,
    constraint_distribution: validConfig.constraintDistribution,
    initial_speed: validConfig.initialSpeed,
    labels: validConfig.labels,
    margins: validConfig.margins,
    options: {
      use_electrical_profiles: validConfig.usingElectricalProfiles,
      use_speed_limits_for_simulation: validConfig.usingSpeedLimits,
    },
    path: validConfig.path,
    power_restrictions: validConfig.powerRestrictions,
    rolling_stock_name: validConfig.rollingStockName,
    schedule: validConfig.schedule,
    speed_limit_tag: validConfig.speedLimitByTag,
    start_time: validConfig.firstStartTime,
    train_name: validConfig.baseTrainName,
  };
}

export function formatPacedTrainPayload(validConfig: ValidConfig): PacedTrain {
  const baseTrain = formatTimetableItemPayload(validConfig);
  return {
    ...baseTrain,
    paced: {
      duration: validConfig.timeRangeDuration,
      step: validConfig.cadence,
    },
  };
}
