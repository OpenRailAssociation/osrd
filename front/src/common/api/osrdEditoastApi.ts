import { sortBy } from 'lodash';

import {
  type GetLightRollingStockApiResponse,
  type GetSpritesSignalingSystemsApiResponse,
  generatedEditoastApi,
  type Property,
} from './generatedEditoastApi';

const formatPathPropertiesProps = (props: Property[]) =>
  props.map((prop) => `props[]=${prop}`).join('&');

const osrdEditoastApi = generatedEditoastApi.enhanceEndpoints({
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
      // As we always use all get trainschedule v2 endpoints after updating the timetable,
      // we don't want to invalidate the trainschedulev2 tag here to prevent multiple calls
      invalidatesTags: ['timetable', 'scenarios'],
    },
    postTimetableByIdTrainSchedule: {
      // As we always use all get trainschedule v2 endpoints after updating the timetable,
      // we don't want to invalidate the trainschedulev2 tag here to prevent multiple calls
      invalidatesTags: ['timetable', 'scenarios'],
    },
    // Invalidate the children count and last update timestamp
    postProjectsByProjectIdStudies: {
      invalidatesTags: ['studies', 'projects'],
    },
    patchProjectsByProjectIdStudiesAndStudyId: {
      invalidatesTags: ['studies', 'projects'],
    },
    deleteProjectsByProjectIdStudiesAndStudyId: {
      invalidatesTags: ['studies', 'projects'],
    },
    postProjectsByProjectIdStudiesAndStudyIdScenarios: {
      invalidatesTags: ['scenarios', 'studies', 'projects'],
    },
    patchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: {
      invalidatesTags: ['scenarios', 'studies', 'projects'],
    },
    deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: {
      invalidatesTags: ['scenarios', 'studies', 'projects'],
    },
  },
});

export * from './generatedEditoastApi';
export { osrdEditoastApi };
