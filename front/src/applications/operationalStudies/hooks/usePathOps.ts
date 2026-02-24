import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';

import {
  osrdEditoastApi,
  type OperationalPointReference,
  type RelatedOperationalPoint,
} from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';

/**
 * Given a train's path, return the operational points corresponding to the pathSteps of this train
 */
const usePathOps = (infraId: number, path?: Train['path']): RelatedOperationalPoint[] => {
  const operationalPointReferences: OperationalPointReference[] = useMemo(
    () =>
      (path ?? [])
        .map((pathItem) => {
          if ('operational_point' in pathItem.location) {
            return pathItem.location.operational_point;
          }
          return null;
        })
        .filter((opRef) => opRef !== null),
    [path]
  );

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

  return useMemo(() => {
    if (
      !operationalPoints?.related_operational_points ||
      operationalPoints.related_operational_points.length === 0
    )
      return [];

    // To remove empty arrays related to invalid step and flatten
    return operationalPoints.related_operational_points.filter((ops) => ops.length !== 0).flat();
  }, [operationalPoints]);
};

export default usePathOps;
