import type { Conflict, TrainCategory } from 'common/api/osrdEditoastApi';
import type {
  TimetableItem,
  TimetableItemId,
  TrainScheduleId,
  PacedTrainId,
  OccurrenceId,
} from 'reducers/osrdconf/types';

export const trainScheduleId = (n: number) => `trainschedule_${n}` as TrainScheduleId;
export const pacedId = (n: number) => `paced_${n}` as PacedTrainId;
export const occurrenceId = (paced: number, index = 0) =>
  `indexedoccurrence_${paced}_${index}` as OccurrenceId;

export const trainSchedule = ({
  id,
  train_name,
  category,
}: {
  id: TimetableItemId;
  train_name: string;
  category?: TrainCategory | null;
}): TimetableItem =>
  ({
    id,
    train_name,
    category: category ?? null,
  }) as TimetableItem;

export const pacedTrain = ({
  id,
  train_name,
  category,
  exceptions,
}: {
  id: PacedTrainId;
  train_name: string;
  category?: TrainCategory | null;
  exceptions?: Array<{ key?: string; occurrence_index?: number; train_name?: { value: string } }>;
}): TimetableItem =>
  ({
    id,
    train_name,
    category: category ?? null,
    exceptions: exceptions ?? [],
  }) as TimetableItem;

export const conflictBase = (partial: Partial<Conflict> = {}): Conflict => ({
  conflict_type: 'Spacing',
  end_time: '',
  start_time: '',
  requirements: [],
  train_schedule_ids: [],
  paced_train_occurrence_ids: [],
  work_schedule_ids: [],
  ...partial,
});
