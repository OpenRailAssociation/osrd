import { isEmpty } from 'lodash';

import {
  osrdEditoastApi,
  type PostPacedTrainProjectPathApiResponse,
  type PostPacedTrainOccupancyBlocksApiResponse,
  type CoreTrainPath,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import { extractEditoastIdFromPacedTrainId, formatEditoastIdToPacedTrainId } from 'utils/trainId';

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

  async processBatch(batch: TimetableItemId[]) {
    const { infraId, path, electricalProfileSetId } = this.options;

    const editoastIds = batch.map((id) => extractEditoastIdFromPacedTrainId(id));

    let pacedTrainPromise: Promise<PostPacedTrainProjectPathApiResponse> = Promise.resolve({});
    let pacedTrainOccupancyBlocksPromise: Promise<PostPacedTrainOccupancyBlocksApiResponse> =
      Promise.resolve({});
    if (editoastIds.length > 0) {
      pacedTrainPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postPacedTrainProjectPath.initiate(
            {
              projectPathForm: {
                infra_id: infraId,
                track_section_ranges: path.track_section_ranges,
                ids: editoastIds,
                electrical_profile_set_id: electricalProfileSetId,
              },
            },
            { subscribe: false }
          )
        )
        .unwrap();

      pacedTrainOccupancyBlocksPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postPacedTrainOccupancyBlocks.initiate(
            {
              occupancyBlockForm: {
                infra_id: infraId,
                path,
                ids: editoastIds,
                electrical_profile_set_id: electricalProfileSetId,
              },
            },
            { subscribe: false }
          )
        )
        .unwrap();
    }

    const rawPacedTrainResults = await pacedTrainPromise;
    const rawPacedTrainOccupancyBlocks = await pacedTrainOccupancyBlocksPromise;

    if (this.cancelled) {
      return;
    }

    const rawResults = new Map<TimetableItemId, ProjectionResult>();

    for (const [id, result] of Object.entries(rawPacedTrainResults)) {
      const pacedTrainId = formatEditoastIdToPacedTrainId(Number(id));
      const pacedTrainProjectionResult: ProjectionResult = {
        space_time_curves: result.paced_train,
        signal_updates: rawPacedTrainOccupancyBlocks[id].paced_train,
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

      rawResults.set(pacedTrainId, pacedTrainProjectionResult);
    }

    this.options.onProgress(rawResults);
  }
}
