import {
  osrdEditoastApi,
  type PacedTrainSimulationSummaryResult,
  type PostPacedTrainSimulationSummaryApiResponse,
} from 'common/api/osrdEditoastApi';
import type { PacedTrainId, TimetableItemId } from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import { formatEditoastIdToPacedTrainId, extractEditoastIdFromPacedTrainId } from 'utils/trainId';

const BATCH_SIZE = 20;

type TrainSimulationLazyLoaderOptions = {
  dispatch: AppDispatch;
  infraId: number;
  electricalProfileSetId?: number;
  onProgress: (pacedTrainSummaries: Map<PacedTrainId, PacedTrainSimulationSummaryResult>) => void;
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

  promise: Promise<void> | undefined = undefined;

  cancelled = false;

  get loading() {
    return !!this.promise;
  }

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
    this.promise ??= this.processPending();
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
    // We assume to be in a single-threaded context and that the VM can
    // only switch execution between promises during await points, so
    // this.pending is guaranteed to be empty here.
    this.promise = undefined;
  }

  async processBatch(batch: TimetableItemId[]) {
    const editoastIds = batch.map((id) => extractEditoastIdFromPacedTrainId(id));

    let pacedTrainPromise: Promise<PostPacedTrainSimulationSummaryApiResponse> = Promise.resolve(
      {}
    );
    if (editoastIds.length > 0) {
      pacedTrainPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postPacedTrainSimulationSummary.initiate(
            {
              body: {
                infra_id: this.options.infraId,
                ids: editoastIds,
                electrical_profile_set_id: this.options.electricalProfileSetId,
              },
            },
            { subscribe: false }
          )
        )
        .unwrap();
    }

    const rawPacedTrainSummaries = await pacedTrainPromise;

    if (this.cancelled) {
      return;
    }

    const pacedTrainSummaries = new Map();
    for (const [rawId, rawSummary] of Object.entries(rawPacedTrainSummaries)) {
      const id = formatEditoastIdToPacedTrainId(Number(rawId));
      pacedTrainSummaries.set(id, rawSummary);
    }

    this.options.onProgress(pacedTrainSummaries);
  }
}
