import { sortBy } from 'lodash';

import {
  type GetLightRollingStockApiResponse,
  type GetSpritesSignalingSystemsApiResponse,
  osrdEditoastApi,
  type Property,
} from './osrdEditoastApi';

const formatPathPropertiesProps = (props: Property[]) =>
  props.map((prop) => `props[]=${prop}`).join('&');

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
  },
});

export { enhancedEditoastApi };
