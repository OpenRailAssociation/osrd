import type { JSONSchema7 } from 'json-schema';
import { omit, omitBy, without } from 'lodash';
import type { Point } from 'geojson';

import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import type { SwitchEntity, SwitchType, TrackEndpoint } from './types';

export function getNewSwitch(type: SwitchType): Partial<SwitchEntity> {
  return {
    type: 'Feature',
    objType: 'Switch',
    properties: {
      ports: {},
      switch_type: type.id as string,
      id: NEW_ENTITY_ID,
    },
  };
}

export function isSwitchValid(entity: Partial<SwitchEntity>, type: SwitchType): boolean {
  return type.ports.every((port) => !!entity.properties?.ports[port]);
}

/**
 * "Flat switch" management:
 */
export const FLAT_SWITCH_PORTS_PREFIX = 'port::' as const;

export type FlatSwitchEntity = Omit<
  EditorEntity<Point, { [key: `${typeof FLAT_SWITCH_PORTS_PREFIX}${string}`]: TrackEndpoint }>,
  'objType'
> & {
  objType: 'FlatSwitch';
};

export const GROUP_CHANGE_DELAY = 'group_change_delay' as const;

export function getSwitchTypeJSONSchema(
  baseSchema: JSONSchema7,
  switchType: SwitchType
): JSONSchema7 {
  return {
    ...baseSchema,
    properties: {
      ...omit(baseSchema.properties, 'ports', 'switch_type'),
      ...switchType.ports.reduce(
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
      ...without(baseSchema.required || [], 'ports', 'switch_type'),
      ...switchType.ports.map((port) => `${FLAT_SWITCH_PORTS_PREFIX}${port}`),
    ],
  };
}

export function flatSwitchToSwitch(
  switchType: SwitchType,
  flatSwitch: FlatSwitchEntity
): SwitchEntity {
  return {
    ...flatSwitch,
    objType: 'Switch',
    properties: {
      ...omitBy(flatSwitch.properties, (_, key) => key.indexOf(FLAT_SWITCH_PORTS_PREFIX) === 0),
      id: flatSwitch.properties.id,
      switch_type: switchType.id as string,
      ports: {
        ...switchType.ports.reduce(
          (iter, port) => ({
            ...iter,
            [port]: flatSwitch.properties[`${FLAT_SWITCH_PORTS_PREFIX}${port}`],
          }),
          {}
        ),
      },
    },
  };
}

export function switchToFlatSwitch(
  switchType: SwitchType,
  inputSwitch: SwitchEntity
): FlatSwitchEntity {
  return {
    ...inputSwitch,
    objType: 'FlatSwitch',
    properties: {
      ...omit(inputSwitch.properties, 'ports', 'switch_type'),
      ...switchType.ports.reduce(
        (iter, port) => ({
          ...iter,
          [`${FLAT_SWITCH_PORTS_PREFIX}${port}`]: inputSwitch.properties.ports[port],
        }),
        {}
      ),
    },
  };
}
