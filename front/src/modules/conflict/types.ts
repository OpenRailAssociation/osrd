import type { Conflict, TrainMainCategory } from 'common/api/osrdEditoastApi';

export type ConflictWithTrainNames = Conflict & {
  trainNames: string[];
  trainCategories: (TrainMainCategory | null)[];
};
