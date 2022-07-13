import { TrackSectionEntity } from '../../../../types';

// eslint-disable-next-line import/prefer-default-export
export function getNewLine(points: [number, number][]): TrackSectionEntity {
  return {
    type: 'Feature',
    objType: 'TrackSection',
    geometry: {
      type: 'LineString',
      coordinates: points,
    },
    properties: {},
  };
}
