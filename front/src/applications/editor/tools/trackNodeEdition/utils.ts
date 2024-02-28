import { JSONSchema7 } from 'json-schema';
import { omit, omitBy, without } from 'lodash';
import { Point } from 'geojson';

import { EditorEntity, TrackNodeEntity, TrackNodeType, TrackEndpoint } from 'types';
import { NEW_ENTITY_ID } from '../../data/utils';

export function getNewTrackNode(type: TrackNodeType): Partial<TrackNodeEntity> {
  return {
    type: 'Feature',
    objType: 'TrackNode',
    properties: {
      ports: {},
      track_node_type: type.id as string,
      id: NEW_ENTITY_ID,
    },
  };
}

export function isTrackNodeValid(entity: Partial<TrackNodeEntity>, type: TrackNodeType): boolean {
  return type.ports.every((port) => !!entity.properties?.ports[port]);
}

/**
 * "Flat track node" management:
 */
export const FLAT_TRACK_NODE_PORTS_PREFIX = 'port::' as const;

export type FlatTrackNodeEntity = Omit<
  EditorEntity<Point, { [key: `${typeof FLAT_TRACK_NODE_PORTS_PREFIX}${string}`]: TrackEndpoint }>,
  'objType'
> & {
  objType: 'FlatTrackNode';
};

export const GROUP_CHANGE_DELAY = 'group_change_delay' as const;

export function getTrackNodeTypeJSONSchema(
  baseSchema: JSONSchema7,
  trackNodeType: TrackNodeType
): JSONSchema7 {
  return {
    ...baseSchema,
    properties: {
      ...omit(baseSchema.properties, 'ports', 'track_node_type'),
      ...Type.trackNodeports.reduce(
        (iter, port) => ({
          ...iter,
          [`${FLAT_TRACK_NODE_PORTS_PREFIX}${port}`]: {
            title: `Port ${port}`,
            $ref: '#/$defs/TrackEndpoint',
          },
        }),
        {}
      ),
    },
    required: [
      ...without(baseSchema.required || [], 'ports', 'track_node_type'),
      ...trackNodeType.ports.map((port) => `${FLAT_TRACK_NODE_PORTS_PREFIX}${port}`),
    ],
  };
}

export function flatTrackNodeToTrackNode(
  trackNodeType: TrackNodeType,
  flatTrackNode: FlatTrackNodeEntity
): TrackNodeEntity {
  return {
    ...flatTrackNode,
    objType: 'TrackNode',
    properties: {
      ...omitBy(flatTrackNode.properties, (_, key) => key.indexOf(FLAT_TRACK_NODE_PORTS_PREFIX) === 0),
      id: flatTrackNode.properties.id,
      track_node_type: trackNodeType.id as string,
      ports: {
        ...trackNodeType.ports.reduce(
          (iter, port) => ({
            ...iter,
            [port]: flatTrackNode.properties[`${FLAT_TRACK_NODE_PORTS_PREFIX}${port}`],
          }),
          {}
        ),
      },
    },
  };
}

export function trackNodeToFlatTrackNode(
  trackNodeType: TrackNodeType,
  inputTrackNode: TrackNodeEntity
): FlatTrackNodeEntity {
  return {
    ...inputTrackNode,
    objType: 'FlatTrackNode',
    properties: {
      ...omit(inputTrackNode.properties, 'ports', 'track_node_type'),
      ...trackNodeType.ports.reduce(
        (iter, port) => ({
          ...iter,
          [`${FLAT_TRACK_NODE_PORTS_PREFIX}${port}`]: inputTrackNode.properties.ports[port],
        }),
        {}
      ),
    },
  };
}
