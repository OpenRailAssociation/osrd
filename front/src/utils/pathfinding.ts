/* eslint-disable import/prefer-default-export */
import { Path } from 'common/api/osrdMiddlewareApi';
import { ArrayElement } from 'utils/types';
import { PointOnMap } from 'applications/operationalStudies/consts';
import { MapState } from 'reducers/map';

export function adjustPointOnTrack(
  point: PointOnMap | ArrayElement<Path['steps']>,
  pathfindingDataStep: ArrayElement<Path['steps']>,
  mapTrackSources: MapState['mapTrackSources'],
  id?: string | number
) {
  const type = mapTrackSources.substring(0, 3) as 'geo' | 'sch';
  return {
    ...point,
    clickLngLat: pathfindingDataStep[type]?.coordinates,
    ...(id ? { id } : {}),
  };
}
