import type { CatalogEntry, TrainScheduleSet } from 'common/api/osrdEditoastApi';

export type TrainScheduleSetImportType = 'copy' | 'reference';

export type CartManagement = {
  cart: Array<{
    trainScheduleSetId: TrainScheduleSet['id'];
    importType: TrainScheduleSetImportType;
  }>;
  upsertToCart: (
    trainScheduleSetId: TrainScheduleSet['id'],
    importType: TrainScheduleSetImportType
  ) => void;
  removeFromCart: (trainScheduleSetId: TrainScheduleSet['id']) => void;
};

export type CatalogById = Map<
  CatalogEntry['id'],
  CatalogEntry & {
    trainScheduleSetIds: TrainScheduleSet['id'][];
  }
>;

export type EnhancedTrainScheduleSet = TrainScheduleSet & { train_schedule_count: number };

export type TrainScheduleSetById = Map<TrainScheduleSet['id'], EnhancedTrainScheduleSet>;
