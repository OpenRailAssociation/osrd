import { TrackSectionEntity } from '../../../../types';

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
