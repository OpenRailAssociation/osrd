import type { Conflict } from 'common/api/osrdEditoastApi';

export type ConflictWithTrainNames = Conflict & {
  trainNames: string[];
};
