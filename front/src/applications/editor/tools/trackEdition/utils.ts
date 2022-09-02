import { EditorEntity, TrackSectionEntity } from '../../../../types';

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

export function injectGeometry(track: EditorEntity): EditorEntity {
  return {
    ...track,
    properties: {
      ...(track.properties || {}),
      geo: track.geometry,
      sch: track.geometry,
    },
  };
}
