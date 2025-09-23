import { isEmpty } from 'lodash';

import {
  osrdEditoastApi,
  type OperationalPointReference,
  type PostPacedTrainOccupancyBlocksApiResponse,
  type PostPacedTrainProjectPathOpApiResponse,
  type PostTrainScheduleOccupancyBlocksApiResponse,
  type PostTrainScheduleProjectPathOpApiResponse,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  formatEditoastIdToPacedTrainId,
  formatEditoastIdToTrainScheduleId,
  isTrainScheduleId,
} from 'utils/trainId';

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

  async processBatch(batch: TimetableItemId[]) {
    const {
      infraId,
      pathfindingResult: { path },
      electricalProfileSetId,
    } = this.options;

    if (this.opRefs.length < 2) {
      this.options.onProgress(new Map());
      return;
    }

    const rawTrainScheduleIds = [];
    const rawPacedTrainIds = [];

    for (const id of batch) {
      if (isTrainScheduleId(id)) {
        rawTrainScheduleIds.push(extractEditoastIdFromTrainScheduleId(id));
      } else {
        rawPacedTrainIds.push(extractEditoastIdFromPacedTrainId(id));
      }
    }

    let trainSchedulePromise: Promise<PostTrainScheduleProjectPathOpApiResponse> = Promise.resolve(
      {}
    );
    let trainScheduleOccupancyBlocksPromise: Promise<PostTrainScheduleOccupancyBlocksApiResponse> =
      Promise.resolve({});
    if (rawTrainScheduleIds.length > 0) {
      trainSchedulePromise = this.options
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

      trainScheduleOccupancyBlocksPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postTrainScheduleOccupancyBlocks.initiate(
            {
              occupancyBlockForm: {
                infra_id: infraId,
                path,
                ids: rawTrainScheduleIds,
                electrical_profile_set_id: electricalProfileSetId,
              },
            },
            { subscribe: false }
          )
        )
        .unwrap();
    }

    let pacedTrainPromise: Promise<PostPacedTrainProjectPathOpApiResponse> = Promise.resolve({});
    let pacedTrainOccupancyBlocksPromise: Promise<PostPacedTrainOccupancyBlocksApiResponse> =
      Promise.resolve({});
    if (rawPacedTrainIds.length > 0) {
      pacedTrainPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postPacedTrainProjectPathOp.initiate(
            {
              body: {
                infra_id: infraId,
                train_ids: rawPacedTrainIds,
                operational_points_refs: this.opRefs,
                operational_points_distances: this.opDistances,
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
                ids: rawPacedTrainIds,
                electrical_profile_set_id: electricalProfileSetId,
              },
            },
            { subscribe: false }
          )
        )
        .unwrap();
    }

    const rawTrainScheduleResults = await trainSchedulePromise;
    const rawPacedTrainResults = await pacedTrainPromise;
    const rawTrainScheduleOccupancyBlocks = await trainScheduleOccupancyBlocksPromise;
    const rawPacedTrainOccupancyBlocks = await pacedTrainOccupancyBlocksPromise;

    if (this.cancelled) {
      return;
    }

    const rawResults = new Map<TimetableItemId, ProjectionResult>();

    for (const [id, result] of Object.entries(rawTrainScheduleResults)) {
      const trainScheduleId = formatEditoastIdToTrainScheduleId(Number(id));
      rawResults.set(trainScheduleId, {
        space_time_curves: result,
        signal_updates: rawTrainScheduleOccupancyBlocks[id],
      });
    }

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
            signal_updates: [],
          });
        }
      }

      rawResults.set(pacedTrainId, pacedTrainProjectionResult);
    }

    this.options.onProgress(rawResults);
  }
}
