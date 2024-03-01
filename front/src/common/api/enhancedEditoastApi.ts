import { sortBy } from 'lodash';

import {
  type GetLightRollingStockApiResponse,
  type GetSpritesSignalingSystemsApiResponse,
  osrdEditoastApi,
} from './osrdEditoastApi';

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
  },
});

export { enhancedEditoastApi };
