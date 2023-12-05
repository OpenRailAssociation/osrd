import { EditorEntity, TrackSectionEntity } from 'types';
import { LinearMetadataItem } from 'common/IntervalsDataViz/types';
import { NEW_ENTITY_ID } from '../../data/utils';

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
      slopes: [],
      curves: [],
      loading_gauge_limits: [],
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

/**
 * Remove the invalid ranges when the length of the track section has been modified
 * - keep ranges if begin is undefined in case we just added a new one or if we deleted the begin input value
 * - remove ranges which start after the new end
 * - cut the ranges which start before the new end but end after it
 */
export function removeInvalidRanges<T>(values: LinearMetadataItem<T>[], newLength: number) {
  return values
    .filter((item) => item.begin < newLength || item.begin === undefined)
    .map((item) => (item.end >= newLength ? { ...item, end: newLength } : item));
}
