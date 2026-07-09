import type { Conflict } from 'common/api/osrdEditoastApi';
import type { TrainScheduleId, OccurrenceId } from 'reducers/osrdconf/types';

export const trainScheduleId = (n: number) => `trainSchedule_${n}` as TrainScheduleId;
export const occurrenceId = (paced: number, index = 0) =>
  `indexedoccurrence_${paced}_${index}` as OccurrenceId;

export const conflictBase = (partial: Partial<Conflict> = {}): Conflict => ({
  conflict_type: 'Spacing',
  duration: 0,
  start_time: 0,
  requirements: [],
  train_ids: [],
  work_schedule_ids: [],
  ...partial,
});
