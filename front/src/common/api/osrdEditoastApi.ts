import { isNil, sortBy } from 'lodash';

import type { TimetableItem, TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  extractPacedTrainIdFromOccurrenceId,
  isTrainScheduleId,
} from 'utils/trainId';

import {
  generatedEditoastApi,
  type EtcsBrakingCurvesResponse,
  type GetLightRollingStockApiResponse,
  type GetSpritesSignalingSystemsApiResponse,
  type MacroNodeResponse,
  type OperationalPointReference,
  type PacedTrainResponse,
  type PathfindingResult,
  type RelatedOperationalPoint,
  type SimulationResponse,
  type TrainScheduleResponse,
} from './generatedEditoastApi';

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
      getAllTimetableByIdPacedTrains: builder.query<PacedTrainResponse[], { timetableId: number }>({
        queryFn: async ({ timetableId }, { dispatch }) => {
          const pageSize = 200;
          let page = 1;
          let reachEnd = false;
          const result: PacedTrainResponse[] = [];
          while (!reachEnd) {
            const data = await dispatch(
              osrdEditoastApi.endpoints.getTimetableByIdPacedTrains.initiate(
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
          let data: TimetableItem;
          if (isTrainScheduleId(timetableItemId)) {
            const trainSchedule = await dispatch(
              generatedEditoastApi.endpoints.getTrainScheduleById.initiate(
                {
                  id: extractEditoastIdFromTrainScheduleId(timetableItemId),
                },
                { subscribe: false }
              )
            ).unwrap();
            data = { ...trainSchedule, id: timetableItemId };
          } else {
            const pacedTrain = await dispatch(
              generatedEditoastApi.endpoints.getPacedTrainById.initiate(
                {
                  id: extractEditoastIdFromPacedTrainId(timetableItemId),
                },
                { subscribe: false }
              )
            ).unwrap();
            data = { ...pacedTrain, id: timetableItemId };
          }
          return { data };
        },
        providesTags: (_result, _error, arg) => [
          'timetable',
          isTrainScheduleId(arg.id) ? 'train_schedule' : 'paced_train',
        ],
      }),
      getTrainPath: builder.query<
        PathfindingResult,
        { id: TrainId; infraId: number; exceptionKey?: string }
      >({
        queryFn: async ({ id: trainId, infraId, exceptionKey }, { dispatch }) => {
          let path: PathfindingResult;
          if (isTrainScheduleId(trainId)) {
            path = await dispatch(
              generatedEditoastApi.endpoints.getTrainScheduleByIdPath.initiate(
                {
                  id: extractEditoastIdFromTrainScheduleId(trainId),
                  infraId,
                },
                { subscribe: false }
              )
            ).unwrap();
          } else {
            const pacedTrainId = extractPacedTrainIdFromOccurrenceId(trainId);
            path = await dispatch(
              generatedEditoastApi.endpoints.getPacedTrainByIdPath.initiate(
                {
                  id: extractEditoastIdFromPacedTrainId(pacedTrainId),
                  infraId,
                  exceptionKey,
                },
                { subscribe: false }
              )
            ).unwrap();
          }
          return { data: path };
        },
        providesTags: (_result, _error, arg) => [
          'pathfinding',
          isTrainScheduleId(arg.id) ? 'train_schedule' : 'paced_train',
        ],
      }),
      getTrainSimulation: builder.query<
        SimulationResponse,
        { id: TrainId; infraId: number; electricalProfileSetId?: number; exceptionKey?: string }
      >({
        queryFn: async (
          { id: trainId, infraId, electricalProfileSetId, exceptionKey },
          { dispatch }
        ) => {
          let simulation: SimulationResponse;
          if (isTrainScheduleId(trainId)) {
            simulation = await dispatch(
              generatedEditoastApi.endpoints.getTrainScheduleByIdSimulation.initiate(
                {
                  id: extractEditoastIdFromTrainScheduleId(trainId),
                  infraId,
                  electricalProfileSetId,
                },
                { subscribe: false }
              )
            ).unwrap();
          } else {
            const pacedTrainId = extractPacedTrainIdFromOccurrenceId(trainId);
            simulation = await dispatch(
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
          }
          return { data: simulation };
        },
        providesTags: (_result, _error, arg) => [
          isTrainScheduleId(arg.id) ? 'train_schedule' : 'paced_train',
        ],
      }),
      getEtcsBrakingCurves: builder.query<
        EtcsBrakingCurvesResponse,
        { id: TrainId; infraId: number; electricalProfileSetId?: number; exceptionKey?: string }
      >({
        queryFn: async (
          { id: trainId, infraId, electricalProfileSetId, exceptionKey },
          { dispatch }
        ) => {
          let etcsBrakingCurves: EtcsBrakingCurvesResponse;
          if (isTrainScheduleId(trainId)) {
            etcsBrakingCurves = await dispatch(
              generatedEditoastApi.endpoints.getTrainScheduleByIdEtcsBrakingCurves.initiate(
                {
                  id: extractEditoastIdFromTrainScheduleId(trainId),
                  infraId,
                  electricalProfileSetId,
                },
                { subscribe: false }
              )
            ).unwrap();
          } else {
            const pacedTrainId = extractPacedTrainIdFromOccurrenceId(trainId);
            etcsBrakingCurves = await dispatch(
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
          }
          return { data: etcsBrakingCurves };
        },
        providesTags: (_result, _error, arg) => [
          isTrainScheduleId(arg.id) ? 'train_schedule' : 'paced_train',
        ],
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
      getAllMacroNodes: builder.query<
        MacroNodeResponse[],
        { projectId: number; studyId: number; scenarioId: number }
      >({
        queryFn: async ({ projectId, studyId, scenarioId }, { dispatch }) => {
          const pageSize = 100;
          let page = 1;
          let reachEnd = false;
          const result: MacroNodeResponse[] = [];
          while (!reachEnd) {
            const data = await dispatch(
              osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodes.initiate(
                {
                  projectId,
                  studyId,
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
      // As we always use all get trainSchedule/pacedTrain endpoints after updating the timetable,
      // we don't want to invalidate the train_schedule/paced_train tags here to prevent multiple calls
      deleteTrainSchedule: {
        invalidatesTags: ['timetable', 'scenarios'],
      },
      deletePacedTrain: {
        invalidatesTags: ['timetable', 'scenarios'],
      },
      postTimetableByIdTrainSchedules: {
        invalidatesTags: ['timetable', 'scenarios'],
      },
      postTimetableByIdPacedTrains: {
        invalidatesTags: ['timetable', 'scenarios'],
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
      getProjectsByProjectIdStudies: {
        providesTags: (result) => [
          { type: 'studies', id: 'LIST' },
          ...(result?.results || []).map(({ id }) => ({
            type: 'studies' as const,
            id,
          })),
        ],
      },
      getProjectsByProjectIdStudiesAndStudyId: {
        providesTags: (_result, _error, args) => [{ type: 'studies', id: args.studyId }],
      },
      postProjectsByProjectIdStudies: {
        invalidatesTags: (_result, _error, args) => [
          { type: 'projects', id: args.projectId },
          { type: 'studies', id: 'LIST' },
        ],
      },
      patchProjectsByProjectIdStudiesAndStudyId: {
        invalidatesTags: (_result, _error, args) => [
          { type: 'projects', id: args.projectId },
          { type: 'studies', id: args.studyId },
        ],
      },
      deleteProjectsByProjectIdStudiesAndStudyId: {
        invalidatesTags: (_result, _error, args) => [
          { type: 'projects', id: args.projectId },
          { type: 'studies', id: 'LIST' },
        ],
      },

      // Scenari handling
      getProjectsByProjectIdStudiesAndStudyIdScenarios: {
        providesTags: (result) => [
          { type: 'scenarios', id: 'LIST' },
          ...(result?.results || []).map(({ id }) => ({
            type: 'scenarios' as const,
            id,
          })),
        ],
      },
      getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: {
        providesTags: (_result, _error, args) => [{ type: 'scenarios', id: args.scenarioId }],
      },
      postProjectsByProjectIdStudiesAndStudyIdScenarios: {
        invalidatesTags: (_result, _error, args) => [
          { type: 'studies', id: args.studyId },
          { type: 'scenarios', id: 'LIST' },
        ],
      },
      patchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: {
        invalidatesTags: (_result, _error, args) => [
          { type: 'studies', id: args.studyId },
          { type: 'scenarios', id: args.scenarioId },
        ],
      },
      deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: {
        invalidatesTags: (_result, _error, args) => [
          { type: 'studies', id: args.studyId },
          { type: 'scenarios', id: 'LIST' },
        ],
      },
    },
  });

export * from './generatedEditoastApi';
export { osrdEditoastApi };
