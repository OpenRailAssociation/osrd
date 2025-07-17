import {
  osrdEditoastApi,
  type PacedTrainSimulationSummaryResult,
  type PostPacedTrainSimulationSummaryApiResponse,
  type PostTrainScheduleSimulationSummaryApiResponse,
  type SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import type { PacedTrainId, TimetableItemId, TrainScheduleId } from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import {
  formatEditoastIdToPacedTrainId,
  formatEditoastIdToTrainScheduleId,
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  isTrainScheduleId,
} from 'utils/trainId';

const BATCH_SIZE = 20;

type TrainSimulationLazyLoaderOptions = {
  dispatch: AppDispatch;
  infraId: number;
  electricalProfileSetId?: number;
  onProgress: (
    trainScheduleSummaries: Map<TrainScheduleId, SimulationSummaryResult>,
    pacedTrainSummaries: Map<PacedTrainId, PacedTrainSimulationSummaryResult>
  ) => void;
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

  pending: TimetableItemId[] = [];

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
  simulateTimetableItems(ids: TimetableItemId[]) {
    if (this.cancelled) {
      throw new Error('simulateTimetableItems() called after cancel()');
    }
    this.pending.push(...ids);
    this.prevPromise = this.prevPromise.finally(() => this.processPending());
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

  async processBatch(batch: TimetableItemId[]) {
    const rawTrainScheduleIds = [];
    const rawPacedTrainIds = [];
    for (const id of batch) {
      if (isTrainScheduleId(id)) {
        rawTrainScheduleIds.push(extractEditoastIdFromTrainScheduleId(id));
      } else {
        rawPacedTrainIds.push(extractEditoastIdFromPacedTrainId(id));
      }
    }

    let trainSchedulePromise: Promise<PostTrainScheduleSimulationSummaryApiResponse> =
      Promise.resolve({});
    if (rawTrainScheduleIds.length > 0) {
      trainSchedulePromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postTrainScheduleSimulationSummary.initiate(
            {
              body: {
                infra_id: this.options.infraId,
                ids: rawTrainScheduleIds,
                electrical_profile_set_id: this.options.electricalProfileSetId,
              },
            },
            { subscribe: false }
          )
        )
        .unwrap();
    }

    let pacedTrainPromise: Promise<PostPacedTrainSimulationSummaryApiResponse> = Promise.resolve(
      {}
    );
    if (rawPacedTrainIds.length > 0) {
      pacedTrainPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postPacedTrainSimulationSummary.initiate(
            {
              body: {
                infra_id: this.options.infraId,
                ids: rawPacedTrainIds,
                electrical_profile_set_id: this.options.electricalProfileSetId,
              },
            },
            { subscribe: false }
          )
        )
        .unwrap();
    }

    const rawTrainScheduleSummaries = await trainSchedulePromise;
    const rawPacedTrainSummaries = await pacedTrainPromise;

    if (this.cancelled) {
      return;
    }

    const trainScheduleSummaries = new Map();
    const pacedTrainSummaries = new Map();
    for (const [rawId, rawSummary] of Object.entries(rawTrainScheduleSummaries)) {
      const id = formatEditoastIdToTrainScheduleId(Number(rawId));
      trainScheduleSummaries.set(id, rawSummary);
    }
    for (const [rawId, rawSummary] of Object.entries(rawPacedTrainSummaries)) {
      const id = formatEditoastIdToPacedTrainId(Number(rawId));
      pacedTrainSummaries.set(id, rawSummary);
    }

    this.options.onProgress(trainScheduleSummaries, pacedTrainSummaries);
  }
}
