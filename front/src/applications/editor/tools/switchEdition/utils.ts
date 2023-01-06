import { JSONSchema7 } from 'json-schema';
import { omit, omitBy, without } from 'lodash';
import { Point } from 'geojson';

import { EditorEntity, SwitchEntity, SwitchType, TrackEndpoint } from '../../../../types';
import { NEW_ENTITY_ID } from '../../data/utils';

export type Reducer<T> = (value: T) => T;
export type ValueOrReducer<T> = T | Reducer<T>;

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

export interface FlatSwitchEntity
  extends EditorEntity<
    Point,
    { [key: `${typeof FLAT_SWITCH_PORTS_PREFIX}${string}`]: TrackEndpoint }
  > {
  objType: 'FlatSwitch';
}

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
            $ref: '#/definitions/TrackEndpoint',
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
