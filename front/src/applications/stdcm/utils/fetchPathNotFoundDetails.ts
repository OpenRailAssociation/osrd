import type { StdcmPathNotFound, StdcmPathNotFoundOutput } from 'applications/stdcm/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

/**
 * Adds the geometry of the partial path reached to a path_not_found response,
 * to draw it on the result map.
 */
const fetchPathNotFoundDetails = async (
  response: StdcmPathNotFound,
  infraId: number,
  dispatch: AppDispatch
): Promise<StdcmPathNotFoundOutput> => {
  const partialPathfindingResult = response.partial_pathfinding_result;
  if (!partialPathfindingResult) return response;

  try {
    const { geometry } = await dispatch(
      osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.initiate({
        infraId,
        pathPropertiesInput: {
          track_section_ranges: partialPathfindingResult.path.track_section_ranges,
        },
      })
    ).unwrap();
    return { ...response, partialPathGeometry: geometry };
  } catch (error) {
    // The failure is still displayed, without its map
    console.error('Error fetching the partial path properties:', error);
    return response;
  }
};

export default fetchPathNotFoundDetails;
