import {
  type CoreSignalUpdate,
  type SpaceTimeCurve,
  type CoreTrainPath,
} from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

const BATCH_SIZE = 20;

export type ProjectionResult = {
  space_time_curves: SpaceTimeCurve[];
  signal_updates?: CoreSignalUpdate[];
  exceptions?: Map<
    string,
    { space_time_curves: SpaceTimeCurve[]; signal_updates: CoreSignalUpdate[] }
  >;
};

export type TrainProjectionLazyLoaderOptions = {
  dispatch: AppDispatch;
  infraId: number;
  timetableId: number;
  path?: CoreTrainPath;
  electricalProfileSetId?: number;
  onProgress: (results: Map<number, ProjectionResult>) => void;
};

export default abstract class TrainProjectionLazyLoaderAbstract {
  readonly options: TrainProjectionLazyLoaderOptions;

  pending: number[] = [];

  prevPromise: Promise<void> = Promise.resolve();

  cancelled = false;

  constructor(options: TrainProjectionLazyLoaderOptions) {
    this.options = options;
  }

  projectTrainSchedules(ids: number[]) {
    if (this.cancelled) {
      throw new Error('projectTrainSchedules() called after cancel()');
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

  abstract processBatch(batch: number[]): Promise<void>;
}
