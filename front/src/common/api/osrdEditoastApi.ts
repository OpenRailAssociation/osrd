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
    postV2InfraByInfraIdPathProperties: {
      query: (queryArg) => ({
        // We currently can't build the url path the way we want with rtk query with the regular endpoint
        // so we need to do it manually with this function and enhanced endpoint
        url: `/v2/infra/${queryArg.infraId}/path_properties?${formatPathPropertiesProps(queryArg.props)}`,
        method: 'POST',
        body: queryArg.pathPropertiesInput,
      }),
    },
    deleteV2TrainSchedule: {
      // As we always use all get trainschedule v2 endpoints after updating the timetable,
      // we don't want to invalidate the trainschedulev2 tag here to prevent multiple calls
      invalidatesTags: ['timetablev2', 'scenariosv2'],
    },
    postV2TimetableByIdTrainSchedule: {
      // As we always use all get trainschedule v2 endpoints after updating the timetable,
      // we don't want to invalidate the trainschedulev2 tag here to prevent multiple calls
      invalidatesTags: ['timetablev2', 'scenariosv2'],
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
    postV2ProjectsByProjectIdStudiesAndStudyIdScenarios: {
      invalidatesTags: ['scenariosv2', 'studies', 'projects'],
    },
    patchV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: {
      invalidatesTags: ['scenariosv2', 'studies', 'projects'],
    },
    deleteV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: {
      invalidatesTags: ['scenariosv2', 'studies', 'projects'],
    },
  },
});

export * from './generatedEditoastApi';
export { osrdEditoastApi };
