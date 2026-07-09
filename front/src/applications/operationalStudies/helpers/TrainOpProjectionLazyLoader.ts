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

    let trainSchedulesPromise: Promise<PostTrainSchedulesProjectPathOpApiResponse> =
      Promise.resolve({});
    let trainScheduleOccupancyBlocksPromise: Promise<PostTrainSchedulesOccupancyBlocksApiResponse> =
      Promise.resolve({});
    if (ids.length > 0) {
      trainSchedulesPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postTrainSchedulesProjectPathOp.initiate(
            {
              body: {
                infra_id: infraId,
                timetable_id: timetableId,
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
        trainScheduleOccupancyBlocksPromise = this.options
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

    const rawTrainScheduleResults = await trainSchedulesPromise;
    const rawTrainScheduleOccupancyBlocks = await trainScheduleOccupancyBlocksPromise;

    if (this.cancelled) {
      return;
    }

    const rawResults = new Map<number, ProjectionResult>();

    for (const [id, result] of Object.entries(rawTrainScheduleResults)) {
      const trainScheduleProjectionResult: ProjectionResult = {
        space_time_curves: result.train_schedule,
        signal_updates: rawTrainScheduleOccupancyBlocks[id]?.train_schedule,
      };

      if (!isEmpty(result.exceptions)) {
        trainScheduleProjectionResult.exceptions = new Map();
        for (const [exceptionId, exception] of Object.entries(result.exceptions)) {
          trainScheduleProjectionResult.exceptions.set(exceptionId, {
            space_time_curves: exception,
            signal_updates: rawTrainScheduleOccupancyBlocks[id]?.exceptions?.[exceptionId] ?? [],
          });
        }
      }

      rawResults.set(Number(id), trainScheduleProjectionResult);
    }

    this.options.onProgress(rawResults);
  }
}
