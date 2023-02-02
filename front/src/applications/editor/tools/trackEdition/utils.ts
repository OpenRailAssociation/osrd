import { EditorEntity, TrackSectionEntity } from '../../../../types';
import { NEW_ENTITY_ID } from '../../data/utils';

// eslint-disable-next-line import/prefer-default-export
export function getNewLine(points: [number, number][]): TrackSectionEntity {
  return {
    type: 'Feature',
    objType: 'TrackSection',
    geometry: {
      type: 'LineString',
      coordinates: points,
    },
    properties: {
      id: NEW_ENTITY_ID,
      length: 0,
    },
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
