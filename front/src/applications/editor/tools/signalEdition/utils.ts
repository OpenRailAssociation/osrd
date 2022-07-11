import { SignalEntity } from '../../../../types';

// eslint-disable-next-line import/prefer-default-export
export function getNewSignal(point: [number, number]): SignalEntity {
  return {
    type: 'Feature',
    objType: 'Signal',
    geometry: {
      type: 'Point',
      coordinates: point,
    },
    properties: {},
  };
}
