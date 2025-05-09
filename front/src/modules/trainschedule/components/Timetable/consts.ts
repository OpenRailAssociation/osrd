import type { ExceptionChangeGroup, OccurrenceExceptionChangeGroups } from './types';

export const specialCodeDictionary: { [key: string]: string } = {
  '': 'NO CODE',
};

export const exceptionChangeGroupsDict: Record<
  OccurrenceExceptionChangeGroups,
  ExceptionChangeGroup
> = {
  constraint_distribution: 'constraintDistribution',
  initial_speed: 'initialVelocity',
  labels: 'labels',
  options: 'electricalProfiles',
  path_and_schedule: 'pathAndSchedule',
  rolling_stock: 'consist',
  rolling_stock_category: 'category',
  speed_limit_tag: 'speedLimitByTag',
  start_time: 'departureTime',
  train_name: 'name',
};
