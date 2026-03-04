import { isEmpty } from 'lodash';

import {
  osrdEditoastApi,
  type OperationalPointReference,
  type PostPacedTrainOccupancyBlocksApiResponse,
  type PostPacedTrainProjectPathOpApiResponse,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import { extractEditoastIdFromPacedTrainId, formatEditoastIdToPacedTrainId } from 'utils/trainId';

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

  async processBatch(batch: TimetableItemId[]) {
    const { infraId, path, electricalProfileSetId } = this.options;

    if (this.opRefs.length < 2) {
      this.options.onProgress(new Map());
      return;
    }

    const editoastIds = batch.map((id) => extractEditoastIdFromPacedTrainId(id));

    let pacedTrainPromise: Promise<PostPacedTrainProjectPathOpApiResponse> = Promise.resolve({});
    let pacedTrainOccupancyBlocksPromise: Promise<PostPacedTrainOccupancyBlocksApiResponse> =
      Promise.resolve({});
    if (editoastIds.length > 0) {
      pacedTrainPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postPacedTrainProjectPathOp.initiate(
            {
              body: {
                infra_id: infraId,
                train_ids: editoastIds,
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
        signal_updates: rawPacedTrainOccupancyBlocks[id]?.paced_train,
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
