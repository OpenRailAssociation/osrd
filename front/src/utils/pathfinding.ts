/* eslint-disable import/prefer-default-export */
import { Path } from 'common/api/osrdMiddlewareApi';
import { ArrayElement } from 'utils/types';
import { PointOnMap } from 'applications/operationalStudies/consts';
import { MapState } from 'reducers/map';

export function adjustPointOnTrack(
  point: PointOnMap | ArrayElement<Path['steps']> | undefined,
  pathfindingDataStep: ArrayElement<Path['steps']> | undefined,
  mapTrackSources: MapState['mapTrackSources'],
  id?: string | number
) {
  if (point && pathfindingDataStep) {
    const type = mapTrackSources.substring(0, 3) as 'geo' | 'sch';
    return {
      ...point,
      clickLngLat: pathfindingDataStep[type]?.coordinates,
      ...(id ? { id } : {}),
    };
  }
  return {};
}
