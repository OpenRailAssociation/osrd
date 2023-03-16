import { groupBy, omit, uniq, toPairs } from 'lodash';
import { v4 as uuid } from 'uuid';
import { compare } from 'fast-json-patch';
import { FeatureCollection } from 'geojson';

import { get, post } from '../../../common/requests';
import { osrdMiddlewareApi } from '../../../common/api/osrdMiddlewareApi';
import {
  GetInfraByIdSwitchTypesApiResponse,
  PostInfraByIdObjectsAndObjectTypeApiResponse,
  PostInfraByIdObjectsAndObjectTypeApiArg,
  GetInfraByIdRoutesAndWaypointTypeWaypointIdApiResponse,
  GetInfraByIdRoutesAndWaypointTypeWaypointIdApiArg,
  PostInfraByIdPathfindingApiArg,
  PostInfraByIdPathfindingApiResponse,
  GetInfraByIdRoutesTrackRangesApiResponse,
} from '../../../common/api/osrdEditoastApi';
import {
  CreateEntityOperation,
  DeleteEntityOperation,
  Direction,
  EditorEntity,
  EditorEntityType,
  EditorSchema,
  EntityOperation,
  EntityOperationResult,
  SwitchType,
  TrackRange,
  UpdateEntityOperation,
  WayPoint,
  WayPointEntity,
  Zone,
} from '../../../types';
import { zoneToBBox } from '../../../utils/mapboxHelper';
import { getObjectTypeForLayer } from './utils';
import { EditoastType } from '../tools/types';
import { RouteCandidate } from '../tools/routeEdition/types';

/**
 * Call the API to get the definition of entities by layer.
 */
export async function getEditorSchema(): Promise<EditorSchema> {
  const schemaResponse = await get('/infra/schema/');
  const fieldToOmit = ['id', 'geo', 'sch'];
  return Object.keys(schemaResponse.properties || {})
    .filter((e: string) => schemaResponse.properties[e].type === 'array')
    .map((e: string) => {
      // we assume here, that the definition of the object is ref and not inline
      const ref = schemaResponse.properties[e].items.$ref.split('/');
      const refTarget = schemaResponse[ref[1]][ref[2]];
      refTarget.properties = omit(refTarget.properties, fieldToOmit);
      refTarget.required = (refTarget.required || []).filter(
        (field: string) => !fieldToOmit.includes(field)
      );

      return {
        layer: e,
        objType: ref[2],
        schema: {
          ...refTarget,
          [ref[1]]: schemaResponse[ref[1]],
        },
      } as EditorSchema[0];
    });
}

/**
 * Call the API for the list of switch types in a given infra.
 */
export async function getSwitchTypes(infra: number): Promise<SwitchType[]> {
  return get(`/editoast/infra/${infra}/switch_types`);
}

/**
 * Call the API for geojson.
 */
export async function getEditorData(
  schema: EditorSchema,
  infra: number,
  layers: Set<string>,
  zone: Zone
): Promise<Record<string, EditorEntity[]>> {
  const bbox = zoneToBBox(zone);
  const layersArray = Array.from(layers);
  const responses = await Promise.all(
    layersArray.map(async (layer) => {
      const objType = getObjectTypeForLayer(schema, layer);
      const result = await get<FeatureCollection>(
        `/layer/${layer}/objects/geo/${bbox[0]}/${bbox[1]}/${bbox[2]}/${bbox[3]}/?infra=${infra}`,
        {}
      );
      return result.features.map((f) => ({ ...f, objType }));
    })
  );

  return layersArray.reduce(
    (iter, layer, i) => ({
      ...iter,
      [layer]: responses[i],
    }),
    {}
  );
}

function editoastToEditorEntity<T extends EditorEntity = EditorEntity>(
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
  if (result && result[id])
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
 * Call the API to update the database.
 */
export async function editorSave(
  infra: number,
  operations: {
    create?: Array<EditorEntity>;
    update?: Array<{ source: EditorEntity; target: EditorEntity }>;
    delete?: Array<EditorEntity>;
  }
): Promise<Array<EntityOperationResult>> {
  const payload: EntityOperation[] = [
    ...(operations.create || []).map(
      (feature): CreateEntityOperation => ({
        operation_type: 'CREATE',
        obj_type: feature.objType,
        railjson: {
          ...feature.properties,
          id: uuid(),
        },
      })
    ),
    ...(operations.update || []).map(
      (features): UpdateEntityOperation => ({
        operation_type: 'UPDATE',
        obj_id: features.source.properties.id,
        obj_type: features.source.objType,
        railjson_patch: compare(
          features.source.properties || {},
          features.target.properties || {}
          // the "as" is mandatory due to the json patch lib that has the not standard "_get" operation
        ) as UpdateEntityOperation['railjson_patch'],
      })
    ),
    ...(operations.delete || []).map(
      (feature): DeleteEntityOperation => ({
        operation_type: 'DELETE',
        obj_id: feature.properties.id,
        obj_type: feature.objType,
      })
    ),
  ];

  return post<EntityOperation[], EntityOperationResult[]>(`/editoast/infra/${infra}`, payload, {});
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
  console.log(res.map((e) => e.type));

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
