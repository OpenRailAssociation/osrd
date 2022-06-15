import { EditorEntity } from '../../../../types';

export function getNewLine(points: [number, number][]): EditorEntity {
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
