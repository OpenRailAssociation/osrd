import { isEmpty } from 'lodash';

import {
  osrdEditoastApi,
  type OperationalPointReference,
  type PostTrainSchedulesOccupancyBlocksApiResponse,
  type PostTrainSchedulesProjectPathOpApiResponse,
} from 'common/api/osrdEditoastApi';

import TrainProjectionLazyLoaderAbstract, {
  type ProjectionResult,
  type TrainProjectionLazyLoaderOptions,
} from './TrainProjectionLazyLoaderAbstract';

export type TrainOpProjectionOptions = TrainProjectionLazyLoaderOptions & {
  isSimulationEnabled: boolean;
};

export default class TrainOpProjectionLazyLoader extends TrainProjectionLazyLoaderAbstract {
  declare readonly options: TrainOpProjectionOptions;

  readonly opRefs: OperationalPointReference[];

  readonly opDistances: number[];

  constructor(
    opRefs: OperationalPointReference[],
    opDistances: number[],
    options: TrainOpProjectionOptions
  ) {
    super(options);
    this.opRefs = opRefs;
    this.opDistances = opDistances;
  }

  async processBatch(ids: number[]) {
    const { infraId, timetableId, path, electricalProfileSetId } = this.options;

    if (this.opRefs.length < 2) {
      this.options.onProgress(new Map());
      return;
    }

    let pacedTrainPromise: Promise<PostTrainSchedulesProjectPathOpApiResponse> = Promise.resolve(
      {}
    );
    let pacedTrainOccupancyBlocksPromise: Promise<PostTrainSchedulesOccupancyBlocksApiResponse> =
      Promise.resolve({});
    if (ids.length > 0) {
      pacedTrainPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postTrainSchedulesProjectPathOp.initiate(
            {
              body: {
                infra_id: infraId,
                train_ids: ids,
                operational_points_refs: this.opRefs,
                operational_points_distances: this.opDistances,
                use_simulation: this.options.isSimulationEnabled,
              },
            },

            { subscribe: false }
          )
        )
        .unwrap();

      if (path) {
        pacedTrainOccupancyBlocksPromise = this.options
          .dispatch(
            osrdEditoastApi.endpoints.postTrainSchedulesOccupancyBlocks.initiate(
              {
                occupancyBlockForm: {
                  infra_id: infraId,
                  timetable_id: timetableId,
                  path,
                  ids,
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
        space_time_curves: result.train_schedule,
        signal_updates: rawPacedTrainOccupancyBlocks[id]?.train_schedule,
      };

      if (!isEmpty(result.exceptions)) {
        pacedTrainProjectionResult.exceptions = new Map();
        for (const [exceptionKey, exception] of Object.entries(result.exceptions)) {
          pacedTrainProjectionResult.exceptions.set(exceptionKey, {
            space_time_curves: exception,
            signal_updates: rawPacedTrainOccupancyBlocks[id]?.exceptions?.[exceptionKey] ?? [],
          });
        }
      }

      rawResults.set(Number(id), pacedTrainProjectionResult);
    }

    this.options.onProgress(rawResults);
  }
}
