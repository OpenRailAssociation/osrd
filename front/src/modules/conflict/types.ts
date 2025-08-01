import type { Conflict, TrainCategory } from 'common/api/osrdEditoastApi';

export type ConflictWithTrainNames = Conflict & {
  trainNames: string[];
  trainCategories: (TrainCategory | null)[];
};
