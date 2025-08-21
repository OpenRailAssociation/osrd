import { useMemo } from 'react';

import {
  osrdEditoastApi,
  type OperationalPoint,
  type OperationalPointReference,
} from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';

import { getStationFromOps, isOperationalPointReference } from '../utils';

/**
 * Given a train, return the operational points corresponding to the pathSteps of this train
 */
const useTrainOps = (infraId: number, train?: Train): OperationalPoint[] => {
  const operationalPointReferences: OperationalPointReference[] = useMemo(
    () =>
      (train?.path ?? []).reduce<OperationalPointReference[]>((acc, pathItem) => {
        if (isOperationalPointReference(pathItem)) {
          const { id: _id, deleted: _deleted, ...cleanOperationalPointReference } = pathItem;
          acc.push(cleanOperationalPointReference);
        }
        return acc;
      }, []),
    [train]
  );

  const { data: operationalPoints } =
    osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.useQuery(
      {
        infraId,
        body: {
          operational_point_references: operationalPointReferences,
        },
      },
      { skip: operationalPointReferences.length === 0 }
    );

  return useMemo(() => {
    if (
      !operationalPoints?.related_operational_points ||
      operationalPoints.related_operational_points.length === 0
    )
      return [];

    return operationalPoints.related_operational_points
      .filter((ops) => ops.length !== 0) // To remove empty arrays related to invalid step
      .map((matchingOps) => getStationFromOps(matchingOps)!);
  }, [operationalPoints]);
};

export default useTrainOps;
