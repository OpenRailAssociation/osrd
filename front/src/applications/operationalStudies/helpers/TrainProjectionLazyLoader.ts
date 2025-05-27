import {
  osrdEditoastApi,
  type ProjectPathTrainResult,
  type PostTrainScheduleProjectPathApiResponse,
  type PostTrainScheduleOccupancyBlocksApiResponse,
  type PostPacedTrainProjectPathApiResponse,
  type PostPacedTrainOccupancyBlocksApiResponse,
  type OccupancyBlockForm,
  type OccupancyBlocks,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';
import {
  formatEditoastIdToPacedTrainId,
  formatEditoastIdToTrainScheduleId,
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  isTrainScheduleId,
} from 'utils/trainId';

const BATCH_SIZE = 20;

export type ProjectionResult = ProjectPathTrainResult & {
  signal_updates: OccupancyBlocks['signal_updates'];
};

type TrainProjectionLazyLoaderOptions = {
  dispatch: AppDispatch;
  infraId: number;
  electricalProfileSetId?: number;
  path: OccupancyBlockForm['path'];
  onProgress: (results: Map<TimetableItemId, ProjectionResult>) => void;
};

export default class TrainProjectionLazyLoader {
  readonly options: TrainProjectionLazyLoaderOptions;

  pending: TimetableItemId[] = [];

  prevPromise: Promise<void> = Promise.resolve();

  cancelled = false;

  constructor(options: TrainProjectionLazyLoaderOptions) {
    this.options = options;
  }

  projectTimetableItems(ids: TimetableItemId[]) {
    if (this.cancelled) {
      throw new Error('projectTimetableItems() called after cancel()');
    }
    this.pending.push(...ids);
    this.prevPromise = this.prevPromise.finally(() => this.processPending());
  }

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
  }

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
          osrdEditoastApi.endpoints.postTrainScheduleOccupancyBlocks.initiate({
            occupancyBlockForm: {
              infra_id: infraId,
              path,
              ids: rawTrainScheduleIds,
              electrical_profile_set_id: electricalProfileSetId,
            },
          })
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
          osrdEditoastApi.endpoints.postPacedTrainOccupancyBlocks.initiate({
            occupancyBlockForm: {
              infra_id: infraId,
              path,
              ids: rawPacedTrainIds,
              electrical_profile_set_id: electricalProfileSetId,
            },
          })
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
        ...result,
        signal_updates: rawTrainScheduleOccupancyBlocks[id].signal_updates,
      });
    }

    for (const [id, result] of Object.entries(rawPacedTrainResults)) {
      const pacedTrainId = formatEditoastIdToPacedTrainId(Number(id));
      rawResults.set(pacedTrainId, {
        ...result,
        signal_updates: rawPacedTrainOccupancyBlocks[id].signal_updates,
      });
    }

    this.options.onProgress(rawResults);
  }
}
