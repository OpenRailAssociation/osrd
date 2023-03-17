import { groupBy, uniq, toPairs } from 'lodash';

import { get, post } from '../../../common/requests';
import {
  PostInfraByIdObjectsAndObjectTypeApiResponse,
  PostInfraByIdObjectsAndObjectTypeApiArg,
  GetInfraByIdRoutesAndWaypointTypeWaypointIdApiResponse,
  GetInfraByIdRoutesAndWaypointTypeWaypointIdApiArg,
  GetInfraByIdRoutesTrackRangesApiResponse,
} from '../../../common/api/osrdEditoastApi';
import {
  Direction,
  EditorEntity,
  EditorEntityType,
  TrackRange,
  WayPoint,
  WayPointEntity,
} from '../../../types';
import { EditoastType } from '../tools/types';
import { RouteCandidate } from '../tools/routeEdition/types';

export function editoastToEditorEntity<T extends EditorEntity = EditorEntity>(
  entity: PostInfraByIdObjectsAndObjectTypeApiResponse[0],
  type: T['objType']
): T {
  return {
    type: 'Feature',
    properties: entity.railjson,
    objType: type,
    geometry: entity.geographic,
  } as T;
}

/**
 * Returns a list of entities from editoast
 */
export async function getEntities<T extends EditorEntity = EditorEntity>(
  infra: number | string,
  ids: string[],
  type: T['objType']
): Promise<Record<string, T>> {
  const uniqIDs = uniq(ids);
  const res = await post<
    PostInfraByIdObjectsAndObjectTypeApiArg['body'],
    PostInfraByIdObjectsAndObjectTypeApiResponse
  >(`/editoast/infra/${infra}/objects/${type}/`, uniqIDs);

  return res.reduce(
    (iter, entry, i) => ({
      ...iter,
      [uniqIDs[i]]: editoastToEditorEntity<T>(entry, type),
    }),
    {}
  );
}

/**
 * Returns an entity from editoast:
 */
export async function getEntity<T extends EditorEntity = EditorEntity>(
  infra: number | string,
  id: string,
  type: T['objType']
): Promise<T> {
  const result = await getEntities<T>(infra, [id], type);
  if (!result || !result[id])
    throw new Error(`getEntity: No entity found for type ${type} and id ${id}`);

  return result[id];
}

export async function getMixedEntities<T extends EditorEntity = EditorEntity>(
  infra: number | string,
  defs: { id: string; type: EditoastType }[]
): Promise<Record<string, T>> {
  const groupedDefs = groupBy(defs, 'type');

  const entities = await Promise.all(
    toPairs(groupedDefs).map(([type, values]) => {
      const ids = values.map(({ id }) => id);
      return getEntities<T>(infra, ids, type as EditoastType);
    })
  );

  return entities.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, T>);
}

/**
 * Returns all routes starting from or ending to a waypoint:
 */
export async function getRoutesFromWaypoint(
  infra: number | string,
  type: EditorEntityType,
  id: GetInfraByIdRoutesAndWaypointTypeWaypointIdApiArg['waypointId']
): Promise<GetInfraByIdRoutesAndWaypointTypeWaypointIdApiResponse> {
  if (type !== 'BufferStop' && type !== 'Detector')
    throw new Error(`${type} elements are not valid waypoints.`);
  return get<GetInfraByIdRoutesAndWaypointTypeWaypointIdApiResponse>(
    `/editoast/infra/${infra}/routes/${type}/${id}`
  );
}

export async function getRouteTrackRanges(
  infra: number | string,
  ids: string[]
): Promise<Record<string, TrackRange[] | null>> {
  const res = await get<GetInfraByIdRoutesTrackRangesApiResponse>(
    `/editoast/infra/${infra}/routes/track_ranges/?routes=${encodeURIComponent(ids.join(','))}`
  );

  return res.reduce(
    (iter, o, i) => ({
      ...iter,
      [ids[i]]: o.type === 'Computed' ? o.track_ranges : null,
    }),
    {} as Record<string, TrackRange[] | null>
  );
}

export async function getCompatibleRoutes(
  infra: number | string,
  entryPoint: WayPoint,
  entryPointDirection: Direction,
  exitPoint: WayPoint
): Promise<Omit<RouteCandidate, 'color'>[]> {
  const extremities = await getMixedEntities<WayPointEntity>(infra, [entryPoint, exitPoint]);
  const entryPointEntity = extremities[entryPoint.id];
  const exitPointEntity = extremities[exitPoint.id];

  if (!entryPointEntity)
    throw new Error(`Entry point ${entryPoint.id} (${entryPoint.type}) not found`);
  if (!exitPointEntity) throw new Error(`Exit point ${exitPoint.id} (${exitPoint.type}) not found`);

  return post(`/editoast/infra/${infra}/pathfinding/`, {
    starting: {
      track: entryPointEntity.properties.track as string,
      position: entryPointEntity.properties.position as number,
      direction: entryPointDirection,
    },
    ending: {
      track: exitPointEntity.properties.track as string,
      position: exitPointEntity.properties.position as number,
    },
  });
}
