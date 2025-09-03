import { useMemo } from 'react';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import {
  osrdEditoastApi,
  type OperationalPointPart,
  type OperationalPointReference,
} from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';

import { getStationFromOps, isOperationalPointReference } from '../utils';

/**
 * Given a train, return the operational points corresponding to the pathSteps of this train
 */
const useTrainOps = (
  infraId: number,
  train?: Train
): PathPropertiesFormatted['operationalPoints'] => {
  const operationalPointReferences: OperationalPointReference[] = useMemo(() => {
    if (!train) return [];
    return train.path.reduce<OperationalPointReference[]>((acc, pathItem) => {
      if (isOperationalPointReference(pathItem)) {
        const { id: _id, deleted: _deleted, ...cleanOperationalPointReference } = pathItem;
        acc.push(cleanOperationalPointReference);
      }
      return acc;
    }, []);
  }, [train]);

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

  // Get this type will facilitate the logic in TimesStopsOutput
  const formattedOperationalPoints: PathPropertiesFormatted['operationalPoints'] = useMemo(() => {
    if (
      !operationalPoints?.related_operational_points ||
      operationalPoints.related_operational_points.length === 0
    ) {
      return [];
    }

    // We have at least one related operational point
    return operationalPoints.related_operational_points
      .filter((ops) => ops.length !== 0) // To remove empty arrays related to invalid step
      .map((ops) => ({
        ...getStationFromOps(ops)!,
        // The following properties will not be used for invalid trains output table data
        part: { position: 0, track: 'unknown' } as OperationalPointPart,
        position: 0,
        weight: null,
      }));
  }, [operationalPoints]);

  return formattedOperationalPoints;
};

export default useTrainOps;
