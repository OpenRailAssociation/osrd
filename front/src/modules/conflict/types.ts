import type { Conflict, TrainCategory } from 'common/api/osrdEditoastApi';

export type ConflictWithTrainNames = Conflict & {
  trainsData: {
    name: string;
    category: TrainCategory | null;
  }[];
};
