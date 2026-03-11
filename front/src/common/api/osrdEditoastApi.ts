import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import { isNil, sortBy } from 'lodash';

import type { TimetableItem, TrainId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';

import type { ApiError } from './baseGeneratedApis';
import postTimetableByIdStdcm from './editoastStream/postTimetableByIdStdcm';
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
  type PostInfraRailjsonApiArg,
  type PostInfraRailjsonApiResponse,
  type PostTimetableByIdStdcmApiResponse,
  type RelatedOperationalPoint,
  type SimulationResponse,
  type StdcmResponse,
} from './generatedEditoastApi';

// Type extension for PostTimetableByIdStdcm to include traceId
export type PostTimetableByIdStdcmApiResponseWithTraceId = PostTimetableByIdStdcmApiResponse & {
  traceId?: string;
};
export type StdcmResponseWithTraceId = StdcmResponse & {
  traceId?: string;
};

/** Helper to easily perform a compressed post query  */
const compressedQuery = async <Response>(
  url: string,
  body: unknown,
  queryParams: unknown,
  baseQuery: (arg: Parameters<BaseQueryFn>[0]) => ReturnType<BaseQueryFn>
) => {
  const compressedStream = new Blob([JSON.stringify(body)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  const compressedBuffer = await new Response(compressedStream).arrayBuffer();
  const compressedBlob = new Blob([compressedBuffer], {
    type: 'application/json',
  });

  const result = await baseQuery({
    url,
    method: 'POST',
    body: compressedBlob,
    params: queryParams,
    headers: {
      'content-encoding': 'gzip',
    },
  });

  return result as { data: Response } | { error: ApiError };
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
      getTimetableItemById: builder.query<TimetableItem, { id: number }>({
        queryFn: async ({ id }, { dispatch }) => {
          const pacedTrain = await dispatch(
            generatedEditoastApi.endpoints.getTrainSchedulesById.initiate(
              {
                id,
              },
              { subscribe: false }
            )
          ).unwrap();
          return { data: pacedTrain };
        },
        providesTags: ['timetable', 'train_schedule'],
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
            generatedEditoastApi.endpoints.getTrainSchedulesByIdPath.initiate(
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
        providesTags: ['pathfinding', 'train_schedule'],
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
            generatedEditoastApi.endpoints.getTrainSchedulesByIdSimulation.initiate(
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
        providesTags: ['train_schedule'],
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
            generatedEditoastApi.endpoints.getTrainSchedulesByIdEtcsBrakingCurves.initiate(
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
        providesTags: ['train_schedule'],
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
  .injectEndpoints({
    overrideExisting: true,
    endpoints: (builder) => ({
      postInfraRailjson: builder.mutation<PostInfraRailjsonApiResponse, PostInfraRailjsonApiArg>({
        queryFn: ({ railJson, name, generateData }, _api, _extraOptions, baseQuery) =>
          compressedQuery<PostInfraRailjsonApiResponse>(
            '/infra/railjson',
            railJson,
            { name, generate_data: generateData },
            baseQuery
          ),
        invalidatesTags: ['infra'],
      }),
    }),
  })
  .enhanceEndpoints({
    endpoints: {
      getLightRollingStock: {
        transformResponse: (response: GetLightRollingStockApiResponse) => ({
          ...response,
          results: sortBy(response?.results, ['metadata.reference', 'name']),
        }),
      },
      getSpritesSignalingSystems: {
        transformResponse: (response: GetSpritesSignalingSystemsApiResponse) => response.sort(),
      },
      // As we always use all get train_schedule endpoints after updating the timetable,
      // we don't want to invalidate the train_schedule tags here to prevent multiple calls

      deleteTrainSchedules: {
        invalidatesTags: ['timetable', 'scenarios'],
      },
      postTrainScheduleSetsByIdTrainSchedules: {
        invalidatesTags: ['train_schedule_set', 'scenarios', 'timetable'],
      },
      postTimetableByIdTrainScheduleException: {
        invalidatesTags: ['train_schedule_exceptions', 'paced_train'],
      },

      postLevelCrossingOccupancy: {
        providesTags: ['level_crossing', 'train_schedule'],
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

      // Scenario handling
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
        invalidatesTags: () => [{ type: 'train_schedule_set', id: 'LIST' }, 'timetable'],
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
      postTrainScheduleSets: {
        invalidatesTags: () => [{ type: 'train_schedule_set', id: 'LIST' }],
      },
      putTrainScheduleSetsById: {
        invalidatesTags: (_result, _error, args) => [{ type: 'train_schedule_set', id: args.id }],
      },
      deleteTrainScheduleSetsById: {
        invalidatesTags: () => [{ type: 'train_schedule_set', id: 'LIST' }, 'timetable'],
      },
    },
  });

export * from './generatedEditoastApi';

/**
 * RTK Query's mutation hook can't expose intermediate streaming events to
 * the component (it only returns a final result). So we replace the
 * generated `postTimetableByIdStdcm` endpoint with a custom streaming
 * function.
 *
 * The generated RTK types are still used to keep type safety on the payload
 */
const enhancedOsrdEditoastApi = {
  ...osrdEditoastApi,
  endpoints: {
    ...osrdEditoastApi.endpoints,
    postTimetableByIdStdcm,
  },
};

export { enhancedOsrdEditoastApi as osrdEditoastApi };
