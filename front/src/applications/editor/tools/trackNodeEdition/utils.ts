import { useCallback, useEffect, useState } from 'react';

import type { Point } from 'geojson';
import type { JSONSchema7 } from 'json-schema';
import { isNil, omit, omitBy, without } from 'lodash';

import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

import type { TrackNodeEntity, TrackNodeType, TrackEndpoint } from './types';

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
 * "Flat switch" management:
 */
export const FLAT_SWITCH_PORTS_PREFIX = 'port::' as const;

export type FlatTrackNodeEntity = Omit<
  EditorEntity<Point, { [key: `${typeof FLAT_SWITCH_PORTS_PREFIX}${string}`]: TrackEndpoint }>,
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
      ...trackNodeType.ports.reduce(
        (iter, port) => ({
          ...iter,
          [`${FLAT_SWITCH_PORTS_PREFIX}${port}`]: {
            title: `Port ${port}`,
            $ref: '#/$defs/TrackEndpoint',
          },
        }),
        {}
      ),
    },
    required: [
      ...without(baseSchema.required || [], 'ports', 'track_node_type'),
      ...trackNodeType.ports.map((port) => `${FLAT_SWITCH_PORTS_PREFIX}${port}`),
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
      ...omitBy(flatTrackNode.properties, (_, key) => key.indexOf(FLAT_SWITCH_PORTS_PREFIX) === 0),
      id: flatTrackNode.properties.id,
      track_node_type: trackNodeType.id as string,
      ports: {
        ...trackNodeType.ports.reduce(
          (iter, port) => ({
            ...iter,
            [port]: flatTrackNode.properties[`${FLAT_SWITCH_PORTS_PREFIX}${port}`],
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
          [`${FLAT_SWITCH_PORTS_PREFIX}${port}`]: inputTrackNode.properties.ports[port],
        }),
        {}
      ),
    },
  };
}

// Client prefered order
const trackNodeTypeOrder = [
  'link',
  'point_switch',
  'crossing',
  'single_slip_switch',
  'double_slip_switch',
];

export function useTrackNodeTypes(infraID: number | undefined) {
  const [data, setData] = useState<TrackNodeType[]>([]);
  const [getInfraTrackNodeTypes, { isLoading, error }] =
    osrdEditoastApi.endpoints.getInfraByInfraIdTrackNodeTypes.useLazyQuery({});

  const fetch = useCallback(
    async (infraId?: number) => {
      // reset
      setData([]);
      try {
        if (!isNil(infraId)) {
          const resp = getInfraTrackNodeTypes({ infraId });
          const result = await resp.unwrap();
          if (result) {
            const orderedData = [...result] as TrackNodeType[];
            orderedData.sort(
              (a, b) => trackNodeTypeOrder.indexOf(a.id) - trackNodeTypeOrder.indexOf(b.id)
            );
            setData(orderedData);
          } else {
            setData([]);
          }
          resp.unsubscribe();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [getInfraTrackNodeTypes]
  );

  useEffect(() => {
    fetch(infraID);
  }, [infraID, fetch]);

  return { data, isLoading, error };
}
