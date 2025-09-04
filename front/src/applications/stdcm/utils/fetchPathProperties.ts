import { omit } from 'lodash';

import type { StdcmPathProperties } from 'applications/stdcm/types';
import type {
  PostInfraByInfraIdPathPropertiesApiArg,
  PathfindingResultSuccess,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { formatSuggestedOperationalPoints } from 'modules/pathfinding/utils';
import type { PathOperationalPoint } from 'modules/simulationResult/types';
import type { SuggestedOP } from 'modules/timetableItem/types';
import type { AppDispatch } from 'store';

/**
 *  Function to fetch and format path properties
 */
const fetchPathProperties = async (
  path: PathfindingResultSuccess,
  infraId: number,
  dispatch: AppDispatch
): Promise<StdcmPathProperties> => {
  const pathPropertiesParams: PostInfraByInfraIdPathPropertiesApiArg = {
    infraId,
    props: ['geometry', 'operational_points', 'zones', 'slopes', 'curves', 'electrifications'],
    pathPropertiesInput: {
      track_section_ranges: path.track_section_ranges,
    },
  };

  try {
    const result = await dispatch(
      osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.initiate(pathPropertiesParams)
    ).unwrap();

    if (!result.geometry || !result.operational_points || !result.zones || !infraId) {
      throw new Error('Missing infraId or pathProperties .');
    }

    const operationalPointsWithUniqueIds: PathOperationalPoint[] = result.operational_points.map(
      (op, index) => ({
        ...omit(op, 'id'),
        waypointId: `${op.id}-${op.position}-${index}`,
        opId: op.id,
      })
    );

    const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
      result.operational_points,
      result.geometry,
      path.length
    );

    return {
      manchetteOperationalPoints: operationalPointsWithUniqueIds,
      geometry: result.geometry,
      suggestedOperationalPoints,
      zones: result.zones,
      slopes: result.slopes,
      curves: result.curves,
      electrifications: result.electrifications,
      operational_points: result.operational_points,
    } as StdcmPathProperties;
  } catch (error) {
    console.error('Error fetching path properties:', error);
    throw new Error('Path properties could not be fetched.');
  }
};

export default fetchPathProperties;
