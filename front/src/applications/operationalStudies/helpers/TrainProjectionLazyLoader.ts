import {
  osrdEditoastApi,
  type ProjectPathForm,
  type ProjectPathTrainResult,
  type PostTrainScheduleProjectPathApiResponse,
  type PostPacedTrainProjectPathApiResponse,
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

type TrainProjectionLazyLoaderOptions = {
  dispatch: AppDispatch;
  infraId: number;
  electricalProfileSetId?: number;
  path: ProjectPathForm['path'];
  onProgress: (results: Map<TimetableItemId, ProjectPathTrainResult>) => void;
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
    if (rawTrainScheduleIds.length > 0) {
      trainSchedulePromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postTrainScheduleProjectPath.initiate(
            {
              projectPathForm: {
                infra_id: this.options.infraId,
                path: this.options.path,
                ids: rawTrainScheduleIds,
                electrical_profile_set_id: this.options.electricalProfileSetId,
              },
            },
            { subscribe: false }
          )
        )
        .unwrap();
    }

    let pacedTrainPromise: Promise<PostPacedTrainProjectPathApiResponse> = Promise.resolve({});
    if (rawPacedTrainIds.length > 0) {
      pacedTrainPromise = this.options
        .dispatch(
          osrdEditoastApi.endpoints.postPacedTrainProjectPath.initiate(
            {
              projectPathForm: {
                infra_id: this.options.infraId,
                path: this.options.path,
                ids: rawPacedTrainIds,
                electrical_profile_set_id: this.options.electricalProfileSetId,
              },
            },
            { subscribe: false }
          )
        )
        .unwrap();
    }

    const rawTrainScheduleResults = await trainSchedulePromise;
    const rawPacedTrainResults = await pacedTrainPromise;

    if (this.cancelled) {
      return;
    }

    const rawResults = new Map();
    for (const [rawId, rawResult] of Object.entries(rawTrainScheduleResults)) {
      const id = formatEditoastIdToTrainScheduleId(Number(rawId));
      rawResults.set(id, rawResult);
    }
    for (const [rawId, rawResult] of Object.entries(rawPacedTrainResults)) {
      const id = formatEditoastIdToPacedTrainId(Number(rawId));
      rawResults.set(id, rawResult);
    }

    this.options.onProgress(rawResults);
  }
}
