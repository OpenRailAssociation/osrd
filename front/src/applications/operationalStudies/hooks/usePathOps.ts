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
): Map<string, RelatedOperationalPoint | null> => {
  const [pathStepKeys, operationalPointReferences]: [string[], OperationalPointReference[]] =
    useMemo(() => {
      const stepKeys = [];
      const stepOpRefs = [];

      for (const pathItem of path ?? []) {
        if (pathItem.location.type === 'operational_point_part_reference') {
          stepKeys.push(pathItem.key);
          stepOpRefs.push(pathItem.location.operational_point);
        }
      }

      return [stepKeys, stepOpRefs];
    }, [path]);

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
    return new Map(relatedOps?.map((op, index) => [pathStepKeys[index], op]));

    // TODO: We should depend on pathStepKeys here, but we can't if we want to keep
    //       them synchronized across the API call. (see usePathProjection for the same problem)
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [operationalPoints]);
};

export default usePathOps;
