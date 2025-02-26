import { isNil, sortBy } from 'lodash';

import {
  type GetLightRollingStockApiResponse,
  type GetSpritesSignalingSystemsApiResponse,
  generatedEditoastApi,
  type Property,
  type TrainScheduleResult,
  type PacedTrainResult,
} from './generatedEditoastApi';

const formatPathPropertiesProps = (props: Property[]) =>
  props.map((prop) => `props[]=${prop}`).join('&');

const osrdEditoastApi = generatedEditoastApi
  .injectEndpoints({
    endpoints: (builder) => ({
      getAllTimetableByIdTrainSchedules: builder.query<
        TrainScheduleResult[],
        { timetableId: number }
      >({
        queryFn: async ({ timetableId }, { dispatch }) => {
          const pageSize = 25;
          let page = 1;
          let reachEnd = false;
          const result: TrainScheduleResult[] = [];
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
      getAllTimetableByIdPacedTrains: builder.query<PacedTrainResult[], { timetableId: number }>({
        queryFn: async ({ timetableId }, { dispatch }) => {
          const pageSize = 25;
          let page = 1;
          let reachEnd = false;
          const result: PacedTrainResult[] = [];
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
      deleteTrainSchedule: {
        // As we always use all get trainschedule endpoints after updating the timetable,
        // we don't want to invalidate the trainschedule tag here to prevent multiple calls
        invalidatesTags: ['timetable', 'scenarios'],
      },
      deletePacedTrain: {
        // As we always use all get paced train endpoints after updating the timetable,
        // we don't want to invalidate the paced train tag here to prevent multiple calls
        invalidatesTags: ['timetable', 'scenarios'],
      },
      postTimetableByIdTrainSchedules: {
        // As we always use all get trainschedule endpoints after updating the timetable,
        // we don't want to invalidate the trainschedule tag here to prevent multiple calls
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
