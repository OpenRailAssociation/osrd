import { BufferStopEntity, DetectorEntity, NULL_GEOMETRY, SignalEntity } from '../../../../types';
import { NEW_ENTITY_ID } from '../../data/utils';

export function getNewSignal(point?: [number, number]): SignalEntity {
  return {
    type: 'Feature',
    objType: 'Signal',
    properties: {
      id: NEW_ENTITY_ID,
      extensions: {
        sncf: {
          is_in_service: false,
          is_lightable: false,
          is_operational: false,
          installation_type: 'S',
        },
      },
    },
    geometry: point
      ? {
          type: 'Point',
          coordinates: point,
        }
      : NULL_GEOMETRY,
  };
}

export function getNewBufferStop(point?: [number, number]): BufferStopEntity {
  return {
    type: 'Feature',
    objType: 'BufferStop',
    properties: {
      id: NEW_ENTITY_ID,
    },
    geometry: point
      ? {
          type: 'Point',
          coordinates: point,
        }
      : NULL_GEOMETRY,
  };
}

export function getNewDetector(point?: [number, number]): DetectorEntity {
  return {
    type: 'Feature',
    objType: 'Detector',
    properties: {
      id: NEW_ENTITY_ID,
    },
    geometry: point
      ? {
          type: 'Point',
          coordinates: point,
        }
      : NULL_GEOMETRY,
  };
}
