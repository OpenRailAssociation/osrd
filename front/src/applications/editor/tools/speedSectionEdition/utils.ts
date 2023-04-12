import { Feature, LineString, Point, Position } from 'geojson';
import length from '@turf/length';
import lineSliceAlong from '@turf/line-slice-along';
import { last, cloneDeep } from 'lodash';
import along from '@turf/along';
import { feature, point } from '@turf/helpers';

import { NEW_ENTITY_ID } from '../../data/utils';
import { SpeedSectionEntity, TrackRange, TrackSectionEntity } from '../../../../types';
import { SpeedSectionEditionState } from './types';
import { DEFAULT_COMMON_TOOL_STATE } from '../types';

export function getNewSpeedSection(): SpeedSectionEntity {
  return {
    type: 'Feature',
    objType: 'SpeedSection',
    properties: {
      id: NEW_ENTITY_ID,
      extensions: {
        lpv_sncf: null,
      },
      track_ranges: [],
      speed_limit_by_tag: {},
    },
    geometry: {
      type: 'MultiLineString',
      coordinates: [],
    },
  };
}

export function getEditSpeedSectionState(entity: SpeedSectionEntity): SpeedSectionEditionState {
  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    initialEntity: cloneDeep(entity),
    entity: cloneDeep(entity),
    trackSectionsCache: {},
    interactionState: { type: 'idle' },
    hoveredPoint: null,
  };
}

type TrackRangeFeature = Feature<LineString, Pick<TrackRange, 'begin' | 'end' | 'track'>>;
type TrackRangeExtremityFeature = Feature<Point, { track: string; position: 'BEGIN' | 'END' }>;
export function getTrackRangeFeatures(
  track: TrackSectionEntity,
  range: Pick<TrackRange, 'begin' | 'end' | 'track'>,
  properties: Record<string, unknown>
): [TrackRangeFeature, TrackRangeExtremityFeature, TrackRangeExtremityFeature] {
  const dataLength = track.properties.length;
  if (range.begin <= 0 && range.end >= dataLength)
    return [
      feature(track.geometry, { ...properties, ...range }),
      point(track.geometry.coordinates[0] as Position, {
        ...properties,
        track: range.track,
        position: 'BEGIN',
      }),
      point(last(track.geometry.coordinates) as Position, {
        ...properties,
        track: range.track,
        position: 'END',
      }),
    ];

  // Since Turf and Editoast do not compute the lengths the same way (see #1751)
  // we can have data "end" being larger than Turf's computed length, which
  // throws an error. Until we find a way to get similar computations, we can
  // approximate this way:
  const computedLength = length(track);
  const begin = (range.begin * computedLength) / dataLength;
  const end = (range.end * computedLength) / dataLength;
  return [
    { ...lineSliceAlong(track.geometry, begin, end), properties: { ...properties, ...range } },
    {
      ...along(track.geometry, (begin * computedLength) / dataLength),
      properties: { ...properties, track: range.track, position: 'BEGIN' },
    },
    {
      ...along(track.geometry, (end * computedLength) / dataLength),
      properties: { ...properties, track: range.track, position: 'END' },
    },
  ];
}

export function getPointAt(track: TrackSectionEntity, at: number): Position {
  const dataLength = track.properties.length;
  if (at <= 0) return track.geometry.coordinates[0];
  if (at >= dataLength) return last(track.geometry.coordinates) as Position;

  const computedLength = length(track);
  return along(track.geometry, (at * computedLength) / dataLength).geometry.coordinates;
}
