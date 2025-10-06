import { useEffect, useState } from 'react';

import {
  osrdEditoastApi,
  type PathfindingResultSuccess,
  type PathProperties,
} from 'common/api/osrdEditoastApi';

const usePathProperties = (infraId?: number, pathfindingResult?: PathfindingResultSuccess) => {
  const [pathProperties, setPathProperties] = useState<PathProperties>();

  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();

  useEffect(() => {
    const getPathProperties = async () => {
      if (infraId && pathfindingResult) {
        const pathPropertiesParams = {
          infraId,
          pathPropertiesInput: {
            track_section_ranges: pathfindingResult.path.track_section_ranges,
          },
        };
        const pathPropertiesResult = await postPathProperties(pathPropertiesParams).unwrap();

        setPathProperties(pathPropertiesResult);
      }
    };

    getPathProperties();
  }, [pathfindingResult]);

  return pathProperties;
};

export default usePathProperties;
