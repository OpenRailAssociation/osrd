import { useEffect, useState } from 'react';

import {
  osrdEditoastApi,
  type PathfindingResultSuccess,
  type PathProperties,
  type Property,
} from 'common/api/osrdEditoastApi';

const usePathProperties = (
  infraId?: number,
  pathfindingResult?: PathfindingResultSuccess,
  properties: Property[] = []
) => {
  const [pathProperties, setPathProperties] = useState<PathProperties>();

  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();

  useEffect(() => {
    const getPathProperties = async () => {
      if (infraId && pathfindingResult && properties.length) {
        const pathPropertiesParams = {
          infraId,
          props: properties,
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
