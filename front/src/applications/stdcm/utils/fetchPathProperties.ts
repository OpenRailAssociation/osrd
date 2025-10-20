import { omit } from 'lodash';

import { getEntities } from 'applications/editor/data/api';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
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
  pathfinding_result: PathfindingResultSuccess,
  infraId: number,
  dispatch: AppDispatch
): Promise<StdcmPathProperties> => {
  const pathPropertiesParams: PostInfraByInfraIdPathPropertiesApiArg = {
    infraId,
    pathPropertiesInput: {
      track_section_ranges: pathfinding_result.path.track_section_ranges,
    },
  };

  try {
    const result = await dispatch(
      osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.initiate(pathPropertiesParams)
    ).unwrap();

    const trackIds = result.operational_points.map((op) => op.part.track);
    const trackSections = await getEntities<TrackSectionEntity>(
      infraId,
      trackIds,
      'TrackSection',
      dispatch
    );

    const operationalPointsWithMetadata = result.operational_points.map((op) => {
      const associatedTrackSection = trackSections[op.part.track];
      const sncf = associatedTrackSection?.properties?.extensions?.sncf;
      const metadata =
        sncf && Object.values(sncf).every((value) => value !== undefined)
          ? {
              lineCode: sncf.line_code!,
              lineName: sncf.line_name!,
              trackName: sncf.track_name!,
              trackNumber: sncf.track_number!,
            }
          : undefined;
      return { ...op, metadata };
    });

    const operationalPointsWithUniqueIds: PathOperationalPoint[] = result.operational_points.map(
      (op, index) => ({
        ...omit(op, 'id'),
        waypointId: `${op.id}-${op.position}-${index}`,
        opId: op.id,
      })
    );

    const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
      operationalPointsWithMetadata,
      result.geometry,
      pathfinding_result.length
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
    };
  } catch (error) {
    console.error('Error fetching path properties:', error);
    throw new Error('Path properties could not be fetched.');
  }
};

export default fetchPathProperties;
