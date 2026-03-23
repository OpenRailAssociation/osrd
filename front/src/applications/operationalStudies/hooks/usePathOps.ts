import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';

import {
  osrdEditoastApi,
  type OperationalPointReference,
  type RelatedOperationalPoint,
} from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';

/**
 * Given a train's path, return the operational points corresponding to the path steps of this train. The map keys are path step IDs.
 */
const usePathOps = (
  infraId: number,
  path?: Train['path']
): Map<string, RelatedOperationalPoint[]> => {
  const opRefMap: Map<string, OperationalPointReference> = useMemo(
    () =>
      new Map(
        path
          ?.map((pathItem) => {
            if (pathItem.location.type === 'operational_point_part_reference') {
              return [pathItem.id, pathItem.location.operational_point] as const;
            }
            return null;
          })
          .filter((entry) => entry !== null)
      ),
    [path]
  );

  const operationalPointReferences = useMemo(() => [...opRefMap.values()], [opRefMap]);

  const { data: operationalPoints } =
    osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.useQuery(
      operationalPointReferences.length > 0
        ? {
            infraId,
            body: {
              operational_point_references: operationalPointReferences,
            },
          }
        : skipToken
    );

  // The /match_operational_points endpoint returns as many output elements
  // as there are input OP refs, in the same order
  return useMemo(() => {
    const relatedOps = operationalPoints?.related_operational_points;
    const pathStepIds = [...opRefMap.keys()];
    return new Map(relatedOps?.map((ops, index) => [pathStepIds[index], ops]));
  }, [operationalPoints]);
};

export default usePathOps;
