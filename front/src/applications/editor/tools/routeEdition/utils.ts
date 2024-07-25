import { lineString, point } from '@turf/helpers';
import lineSlice from '@turf/line-slice';
import type { Feature, LineString, Position } from 'geojson';
import { cloneDeep, first, isEqual, isNil, last } from 'lodash';

import { getEntities, getEntity, getMixedEntities } from 'applications/editor/data/api';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import { DEFAULT_COMMON_TOOL_STATE } from 'applications/editor/tools/consts';
import type {
  OptionsStateType,
  RouteCandidate,
  RouteEditionState,
  RouteEntity,
  WayPoint,
  WayPointEntity,
} from 'applications/editor/tools/routeEdition/types';
import type { TrackRange, TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';
import { NULL_GEOMETRY, type PartialButFor } from 'types';

/**
 * Check if a route is valid or not.
 * This is mainly used to enable/disable the save button
 */
export function routeHasExtremities(route: RouteEntity): boolean {
  let isValid = true;
  if (route.properties.entry_point.id === NEW_ENTITY_ID) isValid = false;
  if (route.properties.exit_point.id === NEW_ENTITY_ID) isValid = false;
  return isValid;
}

/**
 * Get an empty route entity.
 */
function getEmptyRoute(): RouteEntity {
  return {
    type: 'Feature',
    objType: 'Route',
    geometry: NULL_GEOMETRY,
    properties: {
      id: NEW_ENTITY_ID,
      entry_point: { type: 'Detector', id: NEW_ENTITY_ID },
      entry_point_direction: 'START_TO_STOP',
      exit_point: { type: 'Detector', id: NEW_ENTITY_ID },
      track_nodes_directions: {},
      release_detectors: [],
    },
  };
}

/**
 * Return the route edition state for the provided route.
 */
export function getRouteEditionState(route?: RouteEntity): RouteEditionState {
  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    entity: !isNil(route) ? cloneDeep(route) : getEmptyRoute(),
    initialEntity: !isNil(route) ? cloneDeep(route) : undefined,
    isComplete: !isNil(route),
    optionsState: { type: 'idle' },
    extremityState: { type: 'idle' },
    extremitiesEntity: {},
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
  infra: number,
  entryPoint: WayPointEntity,
  exitPoint: WayPointEntity,
  trackRanges: TrackRange[],
  dispatch: AppDispatch
): Promise<Feature<LineString, { id: string }>> {
  if (!trackRanges.length) return lineString([]);

  const tracks = await getEntities<TrackSectionEntity>(
    infra,
    trackRanges.map((trackRange) => trackRange.track),
    'TrackSection',
    dispatch
  );

  return computeRouteGeometry(tracks, entryPoint, exitPoint, trackRanges);
}

async function getRouteGeometryByRoute(
  infra: number,
  route: RouteEntity,
  dispatch: AppDispatch
): Promise<Feature<LineString, { id: string }>> {
  const trackRangesResp = dispatch(
    osrdEditoastApi.endpoints.getInfraByInfraIdRoutesTrackRanges.initiate({
      infraId: infra as number,
      routes: route.properties.id,
    })
  );
  trackRangesResp.unsubscribe();
  const trackRangesResult = (await trackRangesResp).data || [];
  if (trackRangesResult.length === 0 || trackRangesResult[0].type !== 'Computed') {
    throw new Error('Some track ranges could not be computed yet.');
  }
  const trackRanges = trackRangesResult[0].track_ranges;

  const extremities = await getMixedEntities<WayPointEntity>(
    infra,
    [route.properties.entry_point, route.properties.exit_point],
    dispatch
  );
  const entryPoint = extremities[route.properties.entry_point.id];
  const exitPoint = extremities[route.properties.exit_point.id];

  if (!entryPoint)
    throw new Error(
      `Entry point ${route.properties.entry_point.id} (${route.properties.entry_point.type}) for route ${route.properties.id} not found`
    );
  if (!exitPoint)
    throw new Error(
      `Exit point ${route.properties.exit_point.id} (${route.properties.exit_point.type}) for route ${route.properties.id} not found`
    );

  return getRouteGeometry(infra, entryPoint, exitPoint, trackRanges, dispatch);
}

export async function getRouteGeometryByRouteId(
  infra: number,
  routeId: string,
  dispatch: AppDispatch
): Promise<Feature<LineString, { id: string }>> {
  const route = await getEntity<RouteEntity>(infra, routeId, 'Route', dispatch);

  return getRouteGeometryByRoute(infra, route, dispatch);
}

export async function getRouteGeometries(
  infra: number,
  entryPoint: WayPoint,
  exitPoint: WayPoint,
  candidates: RouteCandidate[],
  dispatch: AppDispatch
): Promise<Feature<LineString, { id: string }>[]> {
  const extremities = await getMixedEntities<WayPointEntity>(
    infra,
    [entryPoint, exitPoint],
    dispatch
  );
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
        candidate.track_ranges as TrackRange[],
        dispatch
      )
    )
  );
}

export async function getCompatibleRoutesPayload(
  infra: number,
  entryPoint: WayPoint,
  exitPoint: WayPoint,
  dispatch: AppDispatch
) {
  const extremities = await getMixedEntities<WayPointEntity>(
    infra,
    [entryPoint, exitPoint],
    dispatch
  );
  const entryPointEntity = extremities[entryPoint.id];
  const exitPointEntity = extremities[exitPoint.id];

  if (!entryPointEntity)
    throw new Error(`Entry point ${entryPoint.id} (${entryPoint.type}) not found`);
  if (!exitPointEntity) throw new Error(`Exit point ${exitPoint.id} (${exitPoint.type}) not found`);

  return {
    starting: {
      track: entryPointEntity.properties.track as string,
      position: entryPointEntity.properties.position as number,
    },
    ending: {
      track: exitPointEntity.properties.track as string,
      position: exitPointEntity.properties.position as number,
    },
  };
}

export function getOptionsStateType(optionsStateType: OptionsStateType) {
  if (optionsStateType.type !== 'options') {
    return [];
  }
  if (typeof optionsStateType.focusedOptionIndex === 'number') {
    return [optionsStateType.options[optionsStateType.focusedOptionIndex]];
  }
  return optionsStateType.options;
}
