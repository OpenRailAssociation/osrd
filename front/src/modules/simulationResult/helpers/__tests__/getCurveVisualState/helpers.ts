import type { IndexedOccurrenceId, TrainScheduleId } from 'reducers/osrdconf/types';

import type { CurveStyleInput } from '../../../types';

export const TRAIN_SCHEDULE_1 = 'trainSchedule_1' as TrainScheduleId;
export const TRAIN_SCHEDULE_2 = 'trainSchedule_2' as TrainScheduleId;
export const PACED_1_OCC_2 = 'indexedoccurrence_1_2' as IndexedOccurrenceId;
export const PACED_1_OCC_3 = 'indexedoccurrence_1_3' as IndexedOccurrenceId;
export const PACED_2_OCC_1 = 'indexedoccurrence_2_1' as IndexedOccurrenceId;

export const buildInput = (overrides: Partial<CurveStyleInput> = {}): CurveStyleInput => ({
  chart: 'std',
  train: { id: TRAIN_SCHEDULE_1 },
  selection: undefined,
  ...overrides,
});
