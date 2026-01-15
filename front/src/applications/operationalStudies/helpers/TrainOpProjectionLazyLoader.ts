import { isEmpty } from 'lodash';

import {
  osrdEditoastApi,
  type OperationalPointReference,
  type PostPacedTrainOccupancyBlocksApiResponse,
  type PostPacedTrainProjectPathOpApiResponse,
} from 'common/api/osrdEditoastApi';

import TrainProjectionLazyLoaderAbstract, {
  type ProjectionResult,
  type TrainProjectionLazyLoaderOptions,
} from './TrainProjectionLazyLoaderAbstract';

export default class TrainOpProjectionLazyLoader extends TrainProjectionLazyLoaderAbstract {
  readonly opRefs: OperationalPointReference[];

  readonly opDistances: number[];

  constructor(
    opRefs: OperationalPointReference[],
    opDistances: number[],
    options: TrainProjectionLazyLoaderOptions
  ) {
    super(options);
    this.opRefs = opRefs;
    this.opDistances = opDistances;
  }

  async processBatch(ids: number[]) {
    const { infraId, path, electricalProfileSetId } = this.options;

    if (this.opRefs.length < 2) {
      this.options.onProgress(new Map());
      return;
    }

    let pacedTrainPromise: Promise<PostPacedTrainProjectPathOpApiResponse> = Promise.resolve({});
    let pacedTrainOccupancyBlocksPromise: Promise<PostPacedTrainOccupancyBlocksApiResponse> =
      Promise.resolve({});
    if (ids.length > 0) {
      pacedTrainPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postPacedTrainProjectPathOp.initiate(
            {
              body: {
                infra_id: infraId,
                train_ids: ids,
                operational_points_refs: this.opRefs,
                operational_points_distances: this.opDistances,
              },
            },

            { subscribe: false }
          )
        )
        .unwrap();

      if (path) {
        pacedTrainOccupancyBlocksPromise = this.options
          .dispatch(
            osrdEditoastApi.endpoints.postPacedTrainOccupancyBlocks.initiate(
              {
                occupancyBlockForm: {
                  infra_id: infraId,
                  path,
                  ids: ids,
                  electrical_profile_set_id: electricalProfileSetId,
                },
              },
              { subscribe: false }
            )
          )
          .unwrap();
      }
    }

    const rawPacedTrainResults = await pacedTrainPromise;
    const rawPacedTrainOccupancyBlocks = await pacedTrainOccupancyBlocksPromise;

    if (this.cancelled) {
      return;
    }

    const rawResults = new Map<number, ProjectionResult>();

    for (const [id, result] of Object.entries(rawPacedTrainResults)) {
      const pacedTrainProjectionResult: ProjectionResult = {
        space_time_curves: result.paced_train,
        signal_updates: rawPacedTrainOccupancyBlocks[id]?.paced_train,
      };

      if (!isEmpty(result.exceptions)) {
        pacedTrainProjectionResult.exceptions = new Map();
        for (const [exceptionKey, exception] of Object.entries(result.exceptions)) {
          pacedTrainProjectionResult.exceptions.set(exceptionKey, {
            space_time_curves: exception,
            signal_updates: [],
          });
        }
      }

      rawResults.set(Number(id), pacedTrainProjectionResult);
    }

    this.options.onProgress(rawResults);
  }
}
