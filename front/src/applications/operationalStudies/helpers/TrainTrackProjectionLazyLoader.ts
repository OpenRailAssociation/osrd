import { isEmpty } from 'lodash';

import {
  osrdEditoastApi,
  type PostTrainScheduleProjectPathApiResponse,
  type PostTrainScheduleOccupancyBlocksApiResponse,
  type PostPacedTrainProjectPathApiResponse,
  type PostPacedTrainOccupancyBlocksApiResponse,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  formatEditoastIdToPacedTrainId,
  formatEditoastIdToTrainScheduleId,
  isTrainScheduleId,
} from 'utils/trainId';

import TrainProjectionLazyLoaderAbstract from './TrainProjectionLazyLoaderAbstract';
import type { RawProjectionResult } from './TrainProjectionLazyLoaderAbstract';

export default class TrainTrackProjectionLazyLoader extends TrainProjectionLazyLoaderAbstract {
  async processBatch(batch: TimetableItemId[]) {
    const { infraId, path, electricalProfileSetId } = this.options;

    const rawTrainScheduleIds = [];
    const rawPacedTrainIds = [];
    for (const id of batch) {
      if (isTrainScheduleId(id)) {
        rawTrainScheduleIds.push(extractEditoastIdFromTrainScheduleId(id));
      } else {
        rawPacedTrainIds.push(extractEditoastIdFromPacedTrainId(id));
      }
    }

    let trainSchedulePromise: Promise<PostTrainScheduleProjectPathApiResponse> = Promise.resolve(
      {}
    );
    let trainScheduleOccupancyBlocksPromise: Promise<PostTrainScheduleOccupancyBlocksApiResponse> =
      Promise.resolve({});
    if (rawTrainScheduleIds.length > 0) {
      trainSchedulePromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postTrainScheduleProjectPath.initiate(
            {
              projectPathForm: {
                infra_id: infraId,
                track_section_ranges: path.track_section_ranges,
                ids: rawTrainScheduleIds,
                electrical_profile_set_id: electricalProfileSetId,
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

    let pacedTrainPromise: Promise<PostPacedTrainProjectPathApiResponse> = Promise.resolve({});
    let pacedTrainOccupancyBlocksPromise: Promise<PostPacedTrainOccupancyBlocksApiResponse> =
      Promise.resolve({});
    if (rawPacedTrainIds.length > 0) {
      pacedTrainPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postPacedTrainProjectPath.initiate(
            {
              projectPathForm: {
                infra_id: infraId,
                track_section_ranges: path.track_section_ranges,
                ids: rawPacedTrainIds,
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

    const rawResults = new Map<TimetableItemId, RawProjectionResult>();

    for (const [id, result] of Object.entries(rawTrainScheduleResults)) {
      const trainScheduleId = formatEditoastIdToTrainScheduleId(Number(id));
      rawResults.set(trainScheduleId, {
        space_time_curves: result,
        signal_updates: rawTrainScheduleOccupancyBlocks[id],
      });
    }

    // paced train
    for (const [id, result] of Object.entries(rawPacedTrainResults)) {
      const pacedTrainId = formatEditoastIdToPacedTrainId(Number(id));

      const { paced_train: space_time_curves, exceptions } = result;
      const { paced_train: signal_updates } = rawPacedTrainOccupancyBlocks[id];
      const pacedTrainProjectionResult: RawProjectionResult = {
        space_time_curves,
        signal_updates,
      };

      // exceptions with separate projection.
      if (!isEmpty(exceptions)) {
        pacedTrainProjectionResult.exceptions = new Map();
        for (const [exceptionKey, exception] of Object.entries(exceptions)) {
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
