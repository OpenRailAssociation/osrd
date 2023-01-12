/* eslint-disable import/prefer-default-export */
import { PointOnMap, SuggestedPointOnMap } from 'applications/osrd/consts';
import { MapState } from 'reducers/map';

export function adjustPointOnTrack(
  point: PointOnMap | undefined,
  pathfindingDataStep: SuggestedPointOnMap,
  map: MapState,
  id?: string
) {
  if (point) {
    const type = map.mapTrackSources.substr(0, 3) as 'geo' | 'sch';
    return {
      ...point,
      clickLngLat: pathfindingDataStep[type].coordinates,
      ...(id ? { id } : {}),
    };
  }
  return {};
}
