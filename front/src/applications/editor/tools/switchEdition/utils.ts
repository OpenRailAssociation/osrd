import { JSONSchema7 } from 'json-schema';
import { first, last, omit, omitBy, without } from 'lodash';
import { Point } from 'geojson';

import {
  EditorEntity,
  SwitchEntity,
  SwitchType,
  TrackEndpoint,
  TrackSectionEntity,
} from '../../../../types';

export function getNewSwitch(type: SwitchType): Partial<SwitchEntity> {
  return {
    type: 'Feature',
    objType: 'Switch',
    properties: {
      ports: {},
      switch_type: type.id as string,
    },
  };
}

export function isSwitchValid(entity: Partial<SwitchEntity>, type: SwitchType): boolean {
  return type.ports.every((port) => !!entity.properties?.ports[port]);
}

export function injectGeometry(
  switchEntity: SwitchEntity,
  switchType: SwitchType,
  trackSections: Record<string, TrackSectionEntity>
): Partial<SwitchEntity> {
  const port = switchEntity.properties.ports[switchType.ports[0]];
  if (!port) return omit(switchEntity, 'geometry');

  const track = trackSections[port.track];
  if (!track || !track.geometry.coordinates.length) return omit(switchEntity, 'geometry');

  const coordinates =
    port.endpoint === 'BEGIN'
      ? first(track.geometry.coordinates)
      : last(track.geometry.coordinates);
  return {
    ...switchEntity,
    geometry: {
      type: 'Point',
      coordinates: coordinates as [number, number],
    },
  };
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
