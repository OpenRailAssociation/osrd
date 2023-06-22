import { sortBy } from 'lodash';

import { osrdEditoastApi, GetLightRollingStockApiResponse } from "./osrdEditoastApi";

const enhancedEditoastApi = osrdEditoastApi.enhanceEndpoints({
  endpoints: {
    getLightRollingStock: {
      transformResponse: (response: GetLightRollingStockApiResponse) => {
        return {          
          ...response,
            results: sortBy(response?.results, ['metadata.reference', 'name']),
        }
      }
    }
  }
})

export { enhancedEditoastApi } ;
