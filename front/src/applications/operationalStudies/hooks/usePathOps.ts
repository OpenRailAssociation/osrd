import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';

import {
  osrdEditoastApi,
  type OperationalPointReference,
  type RelatedOperationalPoint,
} from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';

import { getStationFromOps, isOperationalPointReference } from '../utils';

/**
 * Given a train's path, return the operational points corresponding to the pathSteps of this train
 */
const usePathOps = (
  infraId: number,
  path?: Train['path'],
  options?: {
    returnAllOps: boolean;
  }
): RelatedOperationalPoint[] => {
  const operationalPointReferences: OperationalPointReference[] = useMemo(
    () =>
      (path ?? []).reduce<OperationalPointReference[]>((acc, pathItem) => {
        if (isOperationalPointReference(pathItem)) {
          const { id: _id, deleted: _deleted, ...cleanOperationalPointReference } = pathItem;
          acc.push(cleanOperationalPointReference);
        }
        return acc;
      }, []),
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

    // To remove empty arrays related to invalid step
    const allValidOps = operationalPoints.related_operational_points.filter(
      (ops) => ops.length !== 0
    );

    if (options?.returnAllOps) {
      return allValidOps.flat();
    }

    return allValidOps.map((matchingOps) => getStationFromOps(matchingOps)!);
  }, [operationalPoints]);
};

export default usePathOps;
