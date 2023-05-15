import { clone, first, isEqual, last } from 'lodash';
import { Feature, LineString, Position } from 'geojson';
import { lineString, point } from '@turf/helpers';
import lineSlice from '@turf/line-slice';

import { RouteCandidate, RouteEditionState } from './types';
import {
  PartialButFor,
  RouteEntity,
  TrackRange,
  TrackSectionEntity,
  WayPoint,
  WayPointEntity,
} from '../../../../types';
import { getEntities, getEntity, getMixedEntities, getRouteTrackRanges } from '../../data/api';
import { DEFAULT_COMMON_TOOL_STATE } from '../commonToolState';

export function getEmptyCreateRouteState(): RouteEditionState {
  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    type: 'editRoutePath',
    routeState: {
      entryPoint: null,
      entryPointDirection: 'START_TO_STOP',
      exitPoint: null,
    },
    optionsState: { type: 'idle' },
    extremityEditionState: { type: 'idle' },
  };
}

export function getEditRouteState(route: RouteEntity): RouteEditionState {
  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    type: 'editRouteMetadata',
    routeEntity: clone(route),
    initialRouteEntity: clone(route),
  };
}

/**
 * This helper deletes consecutive repeted coordinates in an array of
 * coordinates:
 */
export function removeDuplicatePoints(coordinates: Position[]): Position[] {
  const res: Position[] = [];
  let lastPoint: Position | null = null;

  coordinates.forEach((coordinate) => {
    if (!isEqual(coordinate, lastPoint)) res.push(coordinate);
    lastPoint = coordinate;
  });

  return res;
}

export function computeRouteGeometry(
  tracks: Record<string, TrackSectionEntity>,
  entryPoint: WayPointEntity,
  exitPoint: WayPointEntity,
  trackRanges: PartialButFor<TrackRange, 'track' | 'direction'>[]
): Feature<LineString, { id: string }> {
  return lineString(
    removeDuplicatePoints(
      trackRanges.flatMap((range, i) => {
        const track = tracks[range.track];
        const { direction } = range;

        if (!track) throw new Error(`Track ${range.track} not found`);

        const isFirst = !i;
        const isLast = i === trackRanges.length - 1;

        const p1 = first(track.geometry.coordinates) as Position;
        const p2 = last(track.geometry.coordinates) as Position;

        // Weird case of only range:
        if (isFirst && isLast) {
          return direction === 'START_TO_STOP'
            ? lineSlice(entryPoint.geometry, exitPoint.geometry, track.geometry).geometry
                .coordinates
            : lineSlice(exitPoint.geometry, entryPoint.geometry, track.geometry)
                .geometry.coordinates.slice(0)
                .reverse();
        }

        // First:
        if (isFirst) {
          if (direction === 'START_TO_STOP') {
            return lineSlice(entryPoint.geometry, point(p2), track.geometry).geometry.coordinates;
          }

          return lineSlice(point(p1), entryPoint.geometry, track.geometry)
            .geometry.coordinates.slice(0)
            .reverse();
        }

        // Last (we don't know the direction, we must guess from previous point):
        if (isLast) {
          if (direction === 'START_TO_STOP') {
            return lineSlice(point(p1), exitPoint.geometry, track.geometry).geometry.coordinates;
          }

          return lineSlice(exitPoint.geometry, point(p2), track.geometry)
            .geometry.coordinates.slice(0)
            .reverse();
        }

        // All ranges inbetween:
        if (direction === 'START_TO_STOP') {
          return track.geometry.coordinates;
        }

        return track.geometry.coordinates.slice(0).reverse();
      })
    )
  );
}

export async function getRouteGeometry(
  infra: string | number,
  entryPoint: WayPointEntity,
  exitPoint: WayPointEntity,
  trackRanges: TrackRange[]
): Promise<Feature<LineString, { id: string }>> {
  if (!trackRanges.length) return lineString([]);

  const tracks = await getEntities<TrackSectionEntity>(
    infra,
    trackRanges.map((trackRange) => trackRange.track),
    'TrackSection'
  );

  return computeRouteGeometry(tracks, entryPoint, exitPoint, trackRanges);
}

export async function getRouteGeometryByRoute(
  infra: string | number,
  route: RouteEntity
): Promise<Feature<LineString, { id: string }>> {
  const trackRanges = (await getRouteTrackRanges(infra, [route.properties.id]))[
    route.properties.id
  ];
  const extremities = await getMixedEntities<WayPointEntity>(infra, [
    route.properties.entry_point,
    route.properties.exit_point,
  ]);
  const entryPoint = extremities[route.properties.entry_point.id];
  const exitPoint = extremities[route.properties.exit_point.id];

  if (!trackRanges) throw new Error('Some track ranges could not be computed yet.');
  if (!entryPoint)
    throw new Error(
      `Entry point ${route.properties.entry_point.id} (${route.properties.entry_point.type}) for route ${route.properties.id} not found`
    );
  if (!exitPoint)
    throw new Error(
      `Exit point ${route.properties.exit_point.id} (${route.properties.exit_point.type}) for route ${route.properties.id} not found`
    );

  return getRouteGeometry(infra, entryPoint, exitPoint, trackRanges);
}

export async function getRouteGeometryByRouteId(
  infra: string | number,
  routeId: string
): Promise<Feature<LineString, { id: string }>> {
  const route = await getEntity<RouteEntity>(infra, routeId, 'Route');

  return getRouteGeometryByRoute(infra, route);
}

export async function getRouteGeometries(
  infra: string | number,
  entryPoint: WayPoint,
  exitPoint: WayPoint,
  candidates: RouteCandidate[]
): Promise<Feature<LineString, { id: string }>[]> {
  const extremities = await getMixedEntities<WayPointEntity>(infra, [entryPoint, exitPoint]);
  const entryPointEntity = extremities[entryPoint.id];
  const exitPointEntity = extremities[exitPoint.id];

  if (!entryPointEntity)
    throw new Error(`Entry point ${entryPoint.id} (${entryPoint.type}) not found`);
  if (!exitPointEntity) throw new Error(`Exit point ${exitPoint.id} (${exitPoint.type}) not found`);

  return Promise.all(
    candidates.map((candidate) =>
      getRouteGeometry(
        infra,
        entryPointEntity,
        exitPointEntity,
        candidate.track_ranges as TrackRange[]
      )
    )
  );
}
