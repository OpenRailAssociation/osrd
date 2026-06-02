import type { Conflict, TrainCategory, TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import type { PacedTrainId, OccurrenceId } from 'reducers/osrdconf/types';

export const pacedId = (n: number) => `paced_${n}` as PacedTrainId;
export const occurrenceId = (paced: number, index = 0) =>
  `indexedoccurrence_${paced}_${index}` as OccurrenceId;

export const uniqueTrain = ({
  id,
  train_name,
  category,
}: {
  id: number;
  train_name: string;
  category?: TrainCategory | null;
}): TrainScheduleResponse =>
  ({
    id,
    train_name,
    category: category ?? null,
  }) as TrainScheduleResponse;

export const pacedTrain = ({
  id,
  train_name,
  category,
  exceptions,
}: {
  id: number;
  train_name: string;
  category?: TrainCategory | null;
  exceptions?: Array<{ key?: string; occurrence_index?: number; train_name?: { value: string } }>;
}): TrainScheduleResponse =>
  ({
    id,
    train_name,
    category: category ?? null,
    paced: { exceptions },
  }) as TrainScheduleResponse;

export const conflictBase = (partial: Partial<Conflict> = {}): Conflict => ({
  conflict_type: 'Spacing',
  duration: 0,
  start_time: 0,
  requirements: [],
  train_ids: [],
  work_schedule_ids: [],
  ...partial,
});
