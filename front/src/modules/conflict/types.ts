import type { ConflictV2 } from 'common/api/osrdEditoastApi';

export type ConflictWithTrainNames = ConflictV2 & {
  trainNames: string[];
};
