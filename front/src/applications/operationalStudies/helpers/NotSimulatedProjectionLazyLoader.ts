import {
  osrdEditoastApi,
  type OperationalPointReference,
  type PostTrainScheduleProjectPathOpApiResponse,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromTrainScheduleId,
  formatEditoastIdToTrainScheduleId,
  isTrainScheduleId,
} from 'utils/trainId';

import TrainProjectionLazyLoaderAbstract, {
  type ProjectionResult,
  type TrainProjectionLazyLoaderOptions,
} from './TrainProjectionLazyLoaderAbstract';

export default class NotSimulatedProjectionLazyLoader extends TrainProjectionLazyLoaderAbstract {
  readonly opRefs: OperationalPointReference[];

  readonly opDistances: number[];

  constructor(
    options: TrainProjectionLazyLoaderOptions,
    pathSteps: string[] // Array of op_ids or op_refs from path_steps
  ) {
    super(options);

    // Build opRefs from pathSteps
    this.opRefs = pathSteps.map((opId) => ({ operational_point: opId }));

    const distanceBetweenOps = 100_000_000;
    this.opDistances = Array(Math.max(pathSteps.length - 1, 0)).fill(distanceBetweenOps);
  }

  async processBatch(batch: string[]) {
    const { infraId } = this.options;

    const rawTrainScheduleIds = [];

    for (const id of batch) {
      if (isTrainScheduleId(id)) {
        rawTrainScheduleIds.push(extractEditoastIdFromTrainScheduleId(id));
      } else {
        // paced trains not supported in not simulated mode for now
        continue;
      }
    }

    if (rawTrainScheduleIds.length === 0) return;

    const trainSchedulePromise = this.options
      .dispatch(
        osrdEditoastApi.endpoints.postTrainScheduleProjectPathOp.initiate(
          {
            body: {
              infra_id: infraId,
              train_ids: rawTrainScheduleIds,
              operational_points_refs: this.opRefs,
              operational_points_distances: this.opDistances,
            },
          },
          { subscribe: false }
        )
      )
      .unwrap();

    const rawTrainScheduleResults: PostTrainScheduleProjectPathOpApiResponse =
      await trainSchedulePromise;

    if (this.cancelled) return;

    const rawResults = new Map<TimetableItemId, ProjectionResult>();

    for (const [id, result] of Object.entries(rawTrainScheduleResults)) {
      const trainScheduleId = formatEditoastIdToTrainScheduleId(Number(id));
      rawResults.set(trainScheduleId, {
        space_time_curves: result,
        signal_updates: undefined,
      });
    }

    this.options.onProgress(rawResults);
  }
}
