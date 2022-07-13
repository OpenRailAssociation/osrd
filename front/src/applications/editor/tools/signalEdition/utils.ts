import { SignalEntity } from '../../../../types';
import { MakeOptional } from '../types';

// eslint-disable-next-line import/prefer-default-export
export function getNewSignal(point?: [number, number]): MakeOptional<SignalEntity, 'geometry'> {
  return {
    type: 'Feature',
    objType: 'Signal',
    properties: {
      installation_type: 'DIVERS',
    },
    geometry: point
      ? {
          type: 'Point',
          coordinates: point,
        }
      : undefined,
  };
}
