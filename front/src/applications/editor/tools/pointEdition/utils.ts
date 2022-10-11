import { BufferStopEntity, DetectorEntity, SignalEntity } from '../../../../types';
import { MakeOptional } from '../types';

export function getNewSignal(point?: [number, number]): MakeOptional<SignalEntity, 'geometry'> {
  return {
    type: 'Feature',
    objType: 'Signal',
    properties: {
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
      : undefined,
  };
}

export function getNewBufferStop(
  point?: [number, number]
): MakeOptional<BufferStopEntity, 'geometry'> {
  return {
    type: 'Feature',
    objType: 'BufferStop',
    properties: {},
    geometry: point
      ? {
          type: 'Point',
          coordinates: point,
        }
      : undefined,
  };
}

export function getNewDetector(point?: [number, number]): MakeOptional<DetectorEntity, 'geometry'> {
  return {
    type: 'Feature',
    objType: 'Detector',
    properties: {},
    geometry: point
      ? {
          type: 'Point',
          coordinates: point,
        }
      : undefined,
  };
}
