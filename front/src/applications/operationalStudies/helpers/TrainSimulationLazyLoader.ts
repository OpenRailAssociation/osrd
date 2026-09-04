import {
  osrdEditoastApi,
  type TrainScheduleSimulationSummaryResult,
  type PostTrainSchedulesSimulationSummaryApiResponse,
} from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

const BATCH_SIZE = 20;

type TrainSimulationLazyLoaderOptions = {
  dispatch: AppDispatch;
  infraId: number;
  timetableId: number;
  electricalProfileSetId?: number;
  onProgress: (trainScheduleSummaries: Map<number, TrainScheduleSimulationSummaryResult>) => void;
};

/**
 * Takes a stream of train IDs as input, incrementally invokes onProgress when
 * train simulations become available.
 *
 * This helper only takes care of the API requests, it doesn't perform any
 * post-processing of the simulation results.
 */
export default class TrainSimulationLazyLoader {
  readonly options: TrainSimulationLazyLoaderOptions;

  pending: number[] = [];

  prevPromise: Promise<void> = Promise.resolve();

  cancelled = false;

  /**
   * Create a new loader. Options are immutable for the lifetime of the loader.
   */
  constructor(options: TrainSimulationLazyLoaderOptions) {
    this.options = options;
  }

  /**
   * Queue train IDs for simulation.
   */
  simulateTrainSchedules(ids: number[]) {
    if (this.cancelled) {
      throw new Error('simulateTrainSchedules() called after cancel()');
    }
    this.pending.push(...ids);
    this.prevPromise = this.prevPromise.finally(() => this.processPending());
    console.log('simulateTrainSchedules', ids);
  }

  /**
   * Cancel all pending train simulations. The loader cannot be used after
   * calling this method.
   */
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

  async processBatch(ids: number[]) {
    console.log('processBatch', ids);
    let trainSchedulesPromise: Promise<PostTrainSchedulesSimulationSummaryApiResponse> =
      Promise.resolve({});
    if (ids.length > 0) {
      trainSchedulesPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postTrainSchedulesSimulationSummary.initiate(
            {
              body: {
                infra_id: this.options.infraId,
                timetable_id: this.options.timetableId,
                ids,
                electrical_profile_set_id: this.options.electricalProfileSetId,
              },
            },
            { subscribe: false }
          )
        )
        .unwrap();
    }

    const rawTrainScheduleSummaries = await trainSchedulesPromise;

    if (this.cancelled) {
      return;
    }

    const trainScheduleSummaries = new Map();
    for (const [id, rawSummary] of Object.entries(rawTrainScheduleSummaries ?? {})) {
      trainScheduleSummaries.set(Number(id), rawSummary);
    }

    this.options.onProgress(trainScheduleSummaries);
  }
}
