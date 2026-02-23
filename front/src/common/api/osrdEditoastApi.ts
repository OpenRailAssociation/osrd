import { isNil, sortBy } from 'lodash';

import type { TimetableItem, TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';

import {
  generatedEditoastApi,
  type CatalogEntry,
  type CoreEtcsBrakingCurvesResponse,
  type GetLightRollingStockApiResponse,
  type GetSpritesSignalingSystemsApiResponse,
  type MacroNodeResponse,
  type OperationalPointReference,
  type TrainScheduleResponse,
  type PathfindingResult,
  type PostTimetableByIdStdcmApiResponse,
  type RelatedOperationalPoint,
  type SimulationResponse,
} from './generatedEditoastApi';

// Type extension for PostTimetableByIdStdcm to include traceId
export type PostTimetableByIdStdcmApiResponseWithTraceId = PostTimetableByIdStdcmApiResponse & {
  traceId?: string;
};

const osrdEditoastApi = generatedEditoastApi
  .injectEndpoints({
    endpoints: (builder) => ({
      getAllTimetableByIdTrainSchedules: builder.query<
        TrainScheduleResponse[],
        { timetableId: number }
      >({
        queryFn: async ({ timetableId }, { dispatch }) => {
          const pageSize = 200;
          let page = 1;
          let reachEnd = false;
          const result: TrainScheduleResponse[] = [];
          while (!reachEnd) {
            const data = await dispatch(
              osrdEditoastApi.endpoints.getTimetableByIdTrainSchedules.initiate(
                {
                  id: timetableId,
                  pageSize,
                  page,
                },
                { subscribe: false }
              )
            ).unwrap();
            result.push(...data.results);
            reachEnd = isNil(data.next);
            page += 1;
          }
          return { data: result };
        },
        providesTags: ['timetable'],
      }),
      getTimetableItemById: builder.query<TimetableItem, { id: TimetableItemId }>({
        queryFn: async ({ id: timetableItemId }, { dispatch }) => {
          const pacedTrain = await dispatch(
            generatedEditoastApi.endpoints.getPacedTrainById.initiate(
              {
                id: extractEditoastIdFromPacedTrainId(timetableItemId),
              },
              { subscribe: false }
            )
          ).unwrap();
          const data: TimetableItem = { ...pacedTrain, id: timetableItemId };
          return { data };
        },
        providesTags: ['timetable', 'paced_train'],
      }),
      getTrainPath: builder.query<
        PathfindingResult,
        { id: TrainId; infraId: number; exceptionKey?: string }
      >({
        queryFn: async ({ id: trainId, infraId, exceptionKey }, { dispatch }) => {
          const pacedTrainId = isOccurrenceId(trainId)
            ? extractPacedTrainIdFromOccurrenceId(trainId)
            : trainId;
          const path: PathfindingResult = await dispatch(
            generatedEditoastApi.endpoints.getPacedTrainByIdPath.initiate(
              {
                id: extractEditoastIdFromPacedTrainId(pacedTrainId),
                infraId,
                exceptionKey,
              },
              { subscribe: false }
            )
          ).unwrap();
          return { data: path };
        },
        providesTags: ['pathfinding', 'paced_train'],
      }),
      getTrainSimulation: builder.query<
        SimulationResponse,
        { id: TrainId; infraId: number; electricalProfileSetId?: number; exceptionKey?: string }
      >({
        queryFn: async (
          { id: trainId, infraId, electricalProfileSetId, exceptionKey },
          { dispatch }
        ) => {
          const pacedTrainId = isOccurrenceId(trainId)
            ? extractPacedTrainIdFromOccurrenceId(trainId)
            : trainId;
          const simulation = await dispatch(
            generatedEditoastApi.endpoints.getPacedTrainByIdSimulation.initiate(
              {
                id: extractEditoastIdFromPacedTrainId(pacedTrainId),
                infraId,
                electricalProfileSetId,
                exceptionKey,
              },
              { subscribe: false }
            )
          ).unwrap();
          return { data: simulation };
        },
        providesTags: ['paced_train'],
      }),
      getEtcsBrakingCurves: builder.query<
        CoreEtcsBrakingCurvesResponse,
        { id: TrainId; infraId: number; electricalProfileSetId?: number; exceptionKey?: string }
      >({
        queryFn: async (
          { id: trainId, infraId, electricalProfileSetId, exceptionKey },
          { dispatch }
        ) => {
          const pacedTrainId = isOccurrenceId(trainId)
            ? extractPacedTrainIdFromOccurrenceId(trainId)
            : trainId;
          const etcsBrakingCurves = await dispatch(
            generatedEditoastApi.endpoints.getPacedTrainByIdEtcsBrakingCurves.initiate(
              {
                id: extractEditoastIdFromPacedTrainId(pacedTrainId),
                infraId,
                electricalProfileSetId,
                exceptionKey,
              },
              { subscribe: false }
            )
          ).unwrap();
          return { data: etcsBrakingCurves };
        },
        providesTags: ['paced_train'],
      }),
      matchAllOperationalPoints: builder.query<
        RelatedOperationalPoint[][],
        { infraId: number; opRefs: OperationalPointReference[] }
      >({
        queryFn: async ({ infraId, opRefs }, { dispatch }) => {
          const batchSize = 200;
          const result: RelatedOperationalPoint[][] = [];

          // Split opRefs into batches of 200
          for (let i = 0; i < opRefs.length; i += batchSize) {
            const batch = opRefs.slice(i, i + batchSize);

            const promise = dispatch(
              osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.initiate(
                {
                  infraId,
                  body: {
                    operational_point_references: batch,
                  },
                },
                { subscribe: false }
              )
            );

            const data = await promise.unwrap();
            result.push(...data.related_operational_points);
          }

          return { data: result };
        },
        providesTags: ['infra'],
      }),
      getAllMacroNodes: builder.query<MacroNodeResponse[], { scenarioId: number }>({
        queryFn: async ({ scenarioId }, { dispatch }) => {
          const pageSize = 100;
          let page = 1;
          let reachEnd = false;
          const result: MacroNodeResponse[] = [];
          while (!reachEnd) {
            const data = await dispatch(
              osrdEditoastApi.endpoints.getMacroNodes.initiate(
                {
                  scenarioId,
                  pageSize,
                  page,
                },
                { subscribe: false }
              )
            ).unwrap();
            result.push(...data.results);
            reachEnd = isNil(data.next);
            page += 1;
          }
          return { data: result };
        },
        providesTags: ['scenarios'],
      }),
      getAllCatalogEntries: builder.query<CatalogEntry[], unknown>({
        queryFn: async (_args, { dispatch }) => {
          const pageSize = 100;
          let page = 1;
          let reachEnd = false;
          const result: CatalogEntry[] = [];
          while (!reachEnd) {
            const data = await dispatch(
              osrdEditoastApi.endpoints.getCatalogEntries.initiate(
                {
                  pageSize,
                  page,
                },
                { subscribe: false }
              )
            ).unwrap();
            result.push(...data.results);
            reachEnd = isNil(data.next);
            page += 1;
          }
          return { data: result };
        },
        providesTags: ['catalog_entry'],
      }),
    }),
  })
  .enhanceEndpoints({
    endpoints: {
      postTimetableByIdStdcm: {
        transformResponse: (
          response: PostTimetableByIdStdcmApiResponse,
          metadata: { response: Response }
        ): PostTimetableByIdStdcmApiResponseWithTraceId => {
          const headers = metadata.response.headers;
          const traceparent = headers.get('traceparent');
          const traceId = traceparent?.split('-')[1];

          return { ...response, traceId };
        },
      },
      getLightRollingStock: {
        transformResponse: (response: GetLightRollingStockApiResponse) => ({
          ...response,
          results: sortBy(response?.results, ['metadata.reference', 'name']),
        }),
      },
      getSpritesSignalingSystems: {
        transformResponse: (response: GetSpritesSignalingSystemsApiResponse) => response.sort(),
      },
      // As we always use all get pacedTrain endpoints after updating the timetable,
      // we don't want to invalidate the paced_train tags here to prevent multiple calls

      deletePacedTrain: {
        invalidatesTags: ['timetable', 'scenarios'],
      },
      postTrainScheduleSetsByIdPacedTrains: {
        invalidatesTags: ['train_schedule_set', 'scenarios'],
      },

      // Project handling
      getProjects: {
        providesTags: (result) => [
          { type: 'projects', id: 'LIST' },
          ...(result?.results || []).map((project) => ({
            type: 'projects' as const,
            id: project.id,
          })),
        ],
      },
      getProjectsByProjectId: {
        providesTags: (_result, _error, args) => [{ type: 'projects', id: args.projectId }],
      },
      postProjects: {
        invalidatesTags: [{ type: 'projects', id: 'LIST' }],
      },
      patchProjectsByProjectId: {
        invalidatesTags: (_result, _error, args) => [{ type: 'projects', id: args.projectId }],
      },
      deleteProjectsByProjectId: {
        invalidatesTags: [{ type: 'projects', id: 'LIST' }],
      },

      // Studies handling
      getStudies: {
        providesTags: (result) => [
          { type: 'studies', id: 'LIST' },
          ...(result?.results || []).map(({ id }) => ({
            type: 'studies' as const,
            id,
          })),
        ],
      },
      getStudiesByStudyId: {
        providesTags: (_result, _error, args) => [{ type: 'studies', id: args.studyId }],
      },
      postStudies: {
        invalidatesTags: () => [
          { type: 'projects', id: 'LIST' },
          { type: 'studies', id: 'LIST' },
        ],
      },
      patchStudiesByStudyId: {
        invalidatesTags: (_result, _error, args) => [
          { type: 'projects', id: 'LIST' },
          { type: 'studies', id: args.studyId },
        ],
      },
      deleteStudiesByStudyId: {
        invalidatesTags: () => [
          { type: 'projects', id: 'LIST' },
          { type: 'studies', id: 'LIST' },
        ],
      },

      // Scenari handling
      getScenarios: {
        providesTags: (result) => [
          { type: 'scenarios', id: 'LIST' },
          ...(result?.results || []).map(({ id }) => ({
            type: 'scenarios' as const,
            id,
          })),
        ],
      },
      getScenariosByScenarioId: {
        providesTags: (_result, _error, args) => [{ type: 'scenarios', id: args.scenarioId }],
      },
      postScenarios: {
        invalidatesTags: () => [
          { type: 'studies', id: 'LIST' },
          { type: 'scenarios', id: 'LIST' },
        ],
      },
      patchScenariosByScenarioId: {
        invalidatesTags: (_result, _error, args) => [
          { type: 'studies', id: 'LIST' },
          { type: 'scenarios', id: args.scenarioId },
        ],
      },
      deleteScenariosByScenarioId: {
        invalidatesTags: () => [
          { type: 'studies', id: 'LIST' },
          { type: 'scenarios', id: 'LIST' },
        ],
      },

      // Search
      postSearch: {
        providesTags: (_result, _error, args) =>
          (
            ({
              user: [],
              study: ['studies'],
              project: ['projects'],
              scenario: ['scenarios'],
              track: ['infra'],
              signal: ['infra'],
              operationalpoint: ['infra'],
              trainschedule: ['train_schedule'],
            }) as const
          )[args.searchPayload.object] ?? [],
      },

      // Train schedule sets handling
      getTimetableByIdTrainScheduleSets: {
        providesTags: (result) => [
          { type: 'train_schedule_set', id: 'LIST' },
          ...(result || []).map(({ id }) => ({
            type: 'train_schedule_set' as const,
            id,
          })),
        ],
      },
      postTimetableByIdTrainScheduleSets: {
        invalidatesTags: () => [{ type: 'train_schedule_set', id: 'LIST' }],
      },
      getTrainScheduleSets: {
        providesTags: (result) => [
          { type: 'train_schedule_set', id: 'LIST' },
          ...(result || []).map(({ id }) => ({
            type: 'train_schedule_set' as const,
            id,
          })),
        ],
      },
      getTrainScheduleSetsById: {
        providesTags: (_result, _error, args) => [{ type: 'train_schedule_set', id: args.id }],
      },
      // Don't invalidate the train schedule sets (tss) when creating one as each post is followed
      // by a postTimetableByIdTrainScheduleSets call, which links a tss to a timetable, who
      // is responsible to invalidate the tss list
      postTrainScheduleSets: {
        invalidatesTags: () => [],
      },
      putTrainScheduleSetsById: {
        invalidatesTags: (_result, _error, args) => [{ type: 'train_schedule_set', id: args.id }],
      },
      deleteTrainScheduleSetsById: {
        invalidatesTags: () => [],
      },
    },
  });

export * from './generatedEditoastApi';
export { osrdEditoastApi };
