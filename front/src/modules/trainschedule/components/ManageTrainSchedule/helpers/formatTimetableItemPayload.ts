import { compact } from 'lodash';

import type { PacedTrain, TrainSchedule } from 'common/api/osrdEditoastApi';
import getStepLocation from 'modules/pathfinding/helpers/getStepLocation';
import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { kmhToMs } from 'utils/physics';

import formatMargin from './formatMargin';
import formatSchedule from './formatSchedule';

export function formatTimetableItemPayload(
  osrdconf: OperationalStudiesConfState,
  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  rollingStockName: string
): TrainSchedule {
  return {
    category: osrdconf.category,
    comfort: osrdconf.rollingStockComfort,
    constraint_distribution: osrdconf.constraintDistribution,
    initial_speed: osrdconf.initialSpeed ? kmhToMs(osrdconf.initialSpeed) : 0,
    labels: osrdconf.labels,
    margins: formatMargin(compact(osrdconf.pathSteps)),
    options: {
      use_electrical_profiles: osrdconf.usingElectricalProfiles,
      use_speed_limits_for_simulation: osrdconf.usingSpeedLimits,
    },
    path: compact(osrdconf.pathSteps).map((step) => ({ id: step.id, ...getStepLocation(step) })),
    power_restrictions: osrdconf.powerRestriction,
    rolling_stock_name: rollingStockName,
    schedule: formatSchedule(compact(osrdconf.pathSteps)),
    speed_limit_tag: osrdconf.speedLimitByTag,
    start_time: osrdconf.startTime.toISOString(),
    train_name: osrdconf.name,
  };
}

export function formatPacedTrainPayload(
  osrdconf: OperationalStudiesConfState,
  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  rollingStockName: string
): PacedTrain {
  const baseTrain = formatTimetableItemPayload(osrdconf, rollingStockName);
  return {
    ...baseTrain,
    paced: {
      time_window: osrdconf.timeWindow.toISOString(),
      interval: osrdconf.interval.toISOString(),
    },
    exceptions: [],
  };
}
