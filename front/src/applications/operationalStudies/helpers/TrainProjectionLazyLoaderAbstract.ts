import {
  type SignalUpdate,
  type PathfindingResultSuccess,
  type SpaceTimeCurve,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';

const BATCH_SIZE = 20;

export type ProjectionResult = {
  space_time_curves: SpaceTimeCurve[];
  signal_updates?: SignalUpdate[];
  exceptions?: Map<string, { space_time_curves: SpaceTimeCurve[]; signal_updates: SignalUpdate[] }>;
};

export type TrainProjectionLazyLoaderOptions = {
  dispatch: AppDispatch;
  infraId: number;
  pathfindingResult: PathfindingResultSuccess;
  electricalProfileSetId?: number;
  onProgress: (results: Map<TimetableItemId, ProjectionResult>) => void;
};

export default abstract class TrainProjectionLazyLoaderAbstract {
  readonly options: TrainProjectionLazyLoaderOptions;

  pending: TimetableItemId[] = [];

  prevPromise: Promise<void> = Promise.resolve();

  cancelled = false;

  constructor(options: TrainProjectionLazyLoaderOptions) {
    this.options = options;
  }

  projectTimetableItems(ids: TimetableItemId[]) {
    if (this.cancelled) {
      throw new Error('projectTimetableItems() called after cancel()');
    }
    this.pending.push(...ids);
    this.prevPromise = this.prevPromise.finally(() => this.processPending());
  }

  cancel() {
    this.pending = [];
    this.cancelled = true;
  }

  async processPending() {
    while (this.pending.length > 0) {
      const batch = this.pending.slice(0, BATCH_SIZE);
      this.pending = this.pending.slice(BATCH_SIZE);
      await this.processBatch(batch);
    }
  }

  abstract processBatch(batch: TimetableItemId[]): Promise<void>;
}
