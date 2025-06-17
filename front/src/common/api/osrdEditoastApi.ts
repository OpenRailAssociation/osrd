import { isNil, sortBy } from 'lodash';

import type { TimetableItem, TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  extractPacedTrainIdFromOccurrenceId,
  isTrainScheduleId,
} from 'utils/trainId';

import {
  type GetLightRollingStockApiResponse,
  type GetSpritesSignalingSystemsApiResponse,
  generatedEditoastApi,
  type Property,
  type TrainScheduleResponse,
  type PacedTrainResponse,
  type PathfindingResult,
  type SimulationResponse,
} from './generatedEditoastApi';

const formatPathPropertiesProps = (props: Property[]) =>
  props.map((prop) => `props[]=${prop}`).join('&');

const osrdEditoastApi = generatedEditoastApi
  .injectEndpoints({
    endpoints: (builder) => ({
      getAllTimetableByIdTrainSchedules: builder.query<
        TrainScheduleResponse[],
        { timetableId: number }
      >({
        queryFn: async ({ timetableId }, { dispatch }) => {
          const pageSize = 25;
          let page = 1;
          let reachEnd = false;
          const result: TrainScheduleResponse[] = [];
          while (!reachEnd) {
            const promise = dispatch(
              osrdEditoastApi.endpoints.getTimetableByIdTrainSchedules.initiate(
                {
                  id: timetableId,
                  pageSize,
                  page,
                },
                { forceRefetch: true, subscribe: false }
              )
            );
            const { data } = await promise;
            if (data) result.push(...data.results);
            reachEnd = isNil(data?.next);
            page += 1;
          }
          return { data: result };
        },
        providesTags: ['timetable'],
      }),
      getAllTimetableByIdPacedTrains: builder.query<PacedTrainResponse[], { timetableId: number }>({
        queryFn: async ({ timetableId }, { dispatch }) => {
          const pageSize = 25;
          let page = 1;
          let reachEnd = false;
          const result: PacedTrainResponse[] = [];
          while (!reachEnd) {
            const promise = dispatch(
              osrdEditoastApi.endpoints.getTimetableByIdPacedTrains.initiate(
                {
                  id: timetableId,
                  pageSize,
                  page,
                },
                { forceRefetch: true, subscribe: false }
              )
            );
            const { data } = await promise;
            if (data) result.push(...data.results);
            reachEnd = isNil(data?.next);
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
                { forceRefetch: true, subscribe: false }
              )
            ).unwrap();
            data = { ...trainSchedule, id: timetableItemId };
          } else {
            const pacedTrain = await dispatch(
              generatedEditoastApi.endpoints.getPacedTrainById.initiate(
                {
                  id: extractEditoastIdFromPacedTrainId(timetableItemId),
                },
                { forceRefetch: true, subscribe: false }
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
      getTrainPath: builder.query<PathfindingResult, { id: TrainId; infraId: number }>({
        queryFn: async ({ id: trainId, infraId }, { dispatch }) => {
          let path: PathfindingResult;
          if (isTrainScheduleId(trainId)) {
            path = await dispatch(
              generatedEditoastApi.endpoints.getTrainScheduleByIdPath.initiate(
                {
                  id: extractEditoastIdFromTrainScheduleId(trainId),
                  infraId,
                },
                { forceRefetch: true, subscribe: false }
              )
            ).unwrap();
          } else {
            const pacedTrainId = extractPacedTrainIdFromOccurrenceId(trainId);
            path = await dispatch(
              generatedEditoastApi.endpoints.getPacedTrainByIdPath.initiate(
                {
                  id: extractEditoastIdFromPacedTrainId(pacedTrainId),
                  infraId,
                },
                { forceRefetch: true, subscribe: false }
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
        { id: TrainId; infraId: number; electricalProfileSetId?: number }
      >({
        queryFn: async ({ id: trainId, infraId, electricalProfileSetId }, { dispatch }) => {
          let simulation: SimulationResponse;
          if (isTrainScheduleId(trainId)) {
            simulation = await dispatch(
              generatedEditoastApi.endpoints.getTrainScheduleByIdSimulation.initiate(
                {
                  id: extractEditoastIdFromTrainScheduleId(trainId),
                  infraId,
                  electricalProfileSetId,
                },
                { forceRefetch: true, subscribe: false }
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
                },
                { forceRefetch: true, subscribe: false }
              )
            ).unwrap();
          }
          return { data: simulation };
        },
        // TODO: fix getPacedTrainByIdSimulation tags (it should be paced_train)
        providesTags: ['train_schedule'],
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
      // This endpoint will return only the props we ask for and the url needs to be build in a specific way
      // See https://osrd.fr/en/docs/reference/design-docs/timetable/#path
      postInfraByInfraIdPathProperties: {
        query: (queryArg) => ({
          // We currently can't build the url path the way we want with rtk query with the regular endpoint
          // so we need to do it manually with this function and enhanced endpoint
          url: `/infra/${queryArg.infraId}/path_properties?${formatPathPropertiesProps(queryArg.props)}`,
          method: 'POST',
          body: queryArg.pathPropertiesInput,
        }),
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
