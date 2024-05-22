import { sortBy } from 'lodash';

import {
  type GetLightRollingStockApiResponse,
  type GetSpritesSignalingSystemsApiResponse,
  osrdEditoastApi,
  type Property,
} from './osrdEditoastApi';

const formatPathPropertiesProps = (props: Property[]) =>
  props.map((prop) => `props[]=${prop}`).join('&');

const formatURLWithIds = (ids: number[]) => ids.map((id) => `ids[]=${id}`).join('&');

const enhancedEditoastApi = osrdEditoastApi.enhanceEndpoints({
  endpoints: {
    getLightRollingStock: {
      transformResponse: (response: GetLightRollingStockApiResponse) => {
        return {
          ...response,
          results: sortBy(response?.results, ['metadata.reference', 'name']),
        };
      },
    },
    getSpritesSignalingSystems: {
      transformResponse: (response: GetSpritesSignalingSystemsApiResponse) => {
        return response.sort();
      },
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
    getV2TrainScheduleSimulationSummary: {
      query: (queryArg) => ({
        // We currently can't build the url path the way we want with rtk query with the regular endpoint
        // so we need to do it manually with this function and enhanced endpoint
        url: `/v2/train_schedule/simulation_summary?infra=${queryArg.infra}&${formatURLWithIds(queryArg.ids)}`,
        method: 'GET',
      }),
    },
    getV2TrainSchedule: {
      query: (queryArg) => ({
        // We currently can't build the url path the way we want with rtk query with the regular endpoint
        // so we need to do it manually with this function and enhanced endpoint
        url: `/v2/train_schedule?${formatURLWithIds(queryArg.ids)}`,
        method: 'GET',
      }),
    },
    postV2TrainScheduleProjectPath: {
      query: (queryArg) => ({
        // We currently can't build the url path the way we want with rtk query with the regular endpoint
        // so we need to do it manually with this function and enhanced endpoint
        url: `/v2/train_schedule/project_path?infra=${queryArg.infra}&${formatURLWithIds(queryArg.ids)}`,
        method: 'POST',
        body: queryArg.projectPathInput,
      }),
      // As we always use all get trainschedule v2 endpoints after updating the timetable,
      // we don't want to invalidate the trainschedulev2 tag here to preven multiple calls
      invalidatesTags: [],
    },
    deleteV2TrainSchedule: {
      query: (queryArg) => ({
        url: `/v2/train_schedule/`,
        method: 'DELETE',
        body: queryArg.body,
      }),
      // As we always use all get trainschedule v2 endpoints after updating the timetable,
      // we don't want to invalidate the trainschedulev2 tag here to preven multiple calls
      invalidatesTags: ['timetablev2'],
    },
    postV2TimetableByIdTrainSchedule: {
      query: (queryArg) => ({
        url: `/v2/timetable/${queryArg.id}/train_schedule/`,
        method: 'POST',
        body: queryArg.body,
      }),
      // As we always use all get trainschedule v2 endpoints after updating the timetable,
      // we don't want to invalidate the trainschedulev2 tag here to preven multiple calls
      invalidatesTags: ['timetablev2'],
    },
  },
});

export { enhancedEditoastApi };
