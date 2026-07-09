import { isEmpty } from 'lodash';

import {
  osrdEditoastApi,
  type PostTrainSchedulesProjectPathApiResponse,
  type PostTrainSchedulesOccupancyBlocksApiResponse,
  type CoreTrainPath,
} from 'common/api/osrdEditoastApi';

import TrainProjectionLazyLoaderAbstract from './TrainProjectionLazyLoaderAbstract';
import type {
  ProjectionResult,
  TrainProjectionLazyLoaderOptions,
} from './TrainProjectionLazyLoaderAbstract';

export type TrainTrackProjectionLazyLoaderOptions = Omit<
  TrainProjectionLazyLoaderOptions,
  'path'
> & {
  path: CoreTrainPath;
};

export default class TrainTrackProjectionLazyLoader extends TrainProjectionLazyLoaderAbstract {
  /**
   * The `declare` keyword tells TypeScript this is a type refinement, not a new property.
   * @see https://www.typescriptlang.org/docs/handbook/2/classes.html#type-only-field-declarations
   */
  declare readonly options: TrainTrackProjectionLazyLoaderOptions;

  constructor(options: TrainTrackProjectionLazyLoaderOptions) {
    super(options);
  }

  async processBatch(ids: number[]) {
    const { infraId, timetableId, path, electricalProfileSetId } = this.options;

    let trainSchedulesPromise: Promise<PostTrainSchedulesProjectPathApiResponse> = Promise.resolve(
      {}
    );
    let trainScheduleOccupancyBlocksPromise: Promise<PostTrainSchedulesOccupancyBlocksApiResponse> =
      Promise.resolve({});
    if (ids.length > 0) {
      trainSchedulesPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postTrainSchedulesProjectPath.initiate(
            {
              projectPathForm: {
                infra_id: infraId,
                timetable_id: timetableId,
                track_section_ranges: path.track_section_ranges,
                ids,
                electrical_profile_set_id: electricalProfileSetId,
              },
            },
            { subscribe: false }
          )
        )
        .unwrap();

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

    const rawTrainScheduleResults = await trainSchedulesPromise;
    const rawTrainScheduleOccupancyBlocks = await trainScheduleOccupancyBlocksPromise;

    if (this.cancelled) {
      return;
    }

    const rawResults = new Map<number, ProjectionResult>();

    for (const [id, result] of Object.entries(rawTrainScheduleResults)) {
      const trainScheduleProjectionResult: ProjectionResult = {
        space_time_curves: result.train_schedule,
        signal_updates: rawTrainScheduleOccupancyBlocks[id].train_schedule,
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
