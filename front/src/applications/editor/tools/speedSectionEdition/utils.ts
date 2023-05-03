import { Position } from 'geojson';
import { last, cloneDeep, compact, flatMap } from 'lodash';
import along from '@turf/along';
import length from '@turf/length';
import { Feature, feature, lineString, LineString, point } from '@turf/helpers';
import lineSliceAlong from '@turf/line-slice-along';

import { NEW_ENTITY_ID } from '../../data/utils';
import { DEFAULT_COMMON_TOOL_STATE } from '../types';
import { LPVPanel, SpeedSectionEntity, TrackRange, TrackSectionEntity } from '../../../../types';
import {
  SpeedSectionEditionState,
  TrackRangeExtremityFeature,
  TrackRangeFeature,
  TrackState,
} from './types';

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
    hoveredItem: null,
  };
}

export function getTrackRangeFeatures(
  track: TrackSectionEntity,
  range: Pick<TrackRange, 'begin' | 'end' | 'track'>,
  rangeIndex: number,
  properties: Record<string, unknown>
): [TrackRangeFeature, TrackRangeExtremityFeature, TrackRangeExtremityFeature] {
  const dataLength = track.properties.length;
  const begin = Math.max(Math.min(range.begin, range.end), 0);
  const end = Math.min(Math.max(range.begin, range.end), dataLength);

  if (begin <= 0 && end >= dataLength)
    return [
      feature(track.geometry, {
        ...properties,
        ...range,
        id: `speedSectionRangeExtremity::${rangeIndex}::${begin}::${end}`,
        speedSectionItemType: 'TrackRange',
        speedSectionRangeIndex: rangeIndex,
      }),
      point(track.geometry.coordinates[0] as Position, {
        ...properties,
        id: `speedSectionRangeExtremity::${rangeIndex}::${begin}`,
        track: range.track,
        extremity: 'BEGIN',
        speedSectionItemType: 'TrackRangeExtremity',
        speedSectionRangeIndex: rangeIndex,
      }),
      point(last(track.geometry.coordinates) as Position, {
        ...properties,
        id: `speedSectionRangeExtremity::${rangeIndex}::${end}`,
        track: range.track,
        extremity: 'END',
        speedSectionItemType: 'TrackRangeExtremity',
        speedSectionRangeIndex: rangeIndex,
      }),
    ];

  // Since Turf and Editoast do not compute the lengths the same way (see #1751)
  // we can have data "end" being larger than Turf's computed length, which
  // throws an error. Until we find a way to get similar computations, we can
  // approximate this way:
  const computedLength = length(track);
  const adjustedBegin = Math.max((begin * computedLength) / dataLength, 0);
  const adjustedEnd = Math.min((end * computedLength) / dataLength, computedLength);

  let line: Feature<LineString>;
  // See https://github.com/Turfjs/turf/issues/1577 for this issue:
  if (adjustedBegin === adjustedEnd) {
    const { coordinates } = along(track.geometry, adjustedBegin).geometry;
    line = lineString([coordinates, coordinates]);
  } else {
    line = lineSliceAlong(track.geometry, adjustedBegin, adjustedEnd);
  }

  return [
    {
      ...line,
      properties: {
        ...properties,
        ...range,
        id: `speedSectionRangeExtremity::${rangeIndex}::${adjustedBegin}::${adjustedEnd}`,
        speedSectionItemType: 'TrackRange',
        speedSectionRangeIndex: rangeIndex,
      },
    },
    {
      ...along(track.geometry, adjustedBegin),
      properties: {
        ...properties,
        id: `speedSectionRangeExtremity::${rangeIndex}::${adjustedBegin}`,
        track: range.track,
        extremity: 'BEGIN',
        speedSectionItemType: 'TrackRangeExtremity',
        speedSectionRangeIndex: rangeIndex,
      },
    },
    {
      ...along(track.geometry, adjustedEnd),
      properties: {
        ...properties,
        id: `speedSectionRangeExtremity::${rangeIndex}::${adjustedEnd}`,
        track: range.track,
        extremity: 'END',
        speedSectionItemType: 'TrackRangeExtremity',
        speedSectionRangeIndex: rangeIndex,
      },
    },
  ];
}

function generatePointFromLPVPanel(
  panel: LPVPanel,
  trackSectionsCache: Record<string, TrackState>
) {
  const trackState = trackSectionsCache[panel.track];
  if (trackState?.type !== 'success') {
    return null;
  }
  const panelPoint = along(trackState.track, panel.position, { units: 'meters' });
  panelPoint.properties = { ...panel };
  return panelPoint;
}

/** Generate LPV panel Features (Point) from LPV panels and trackSectionCache */
export function generateLpvPanelFeatures(
  lpv: {
    announcement: LPVPanel[];
    z: LPVPanel | null;
    r: LPVPanel[];
  },
  trackSectionsCache: Record<string, TrackState>
) {
  const panels = compact(flatMap(lpv));
  const panelPoints = panels.map((panel) => generatePointFromLPVPanel(panel, trackSectionsCache));
  return compact(panelPoints);
}

export function getPointAt(track: TrackSectionEntity, at: number): Position {
  const dataLength = track.properties.length;
  if (at <= 0) return track.geometry.coordinates[0];
  if (at >= dataLength) return last(track.geometry.coordinates) as Position;

  const computedLength = length(track);
  return along(track.geometry, (at * computedLength) / dataLength).geometry.coordinates;
}

export function msToKmh(v: number): number {
  return v * 3.6;
}
export function kmhToMs(v: number): number {
  return v / 3.6;
}

export function speedSectrionIsLpv(entity: SpeedSectionEntity): boolean {
  return !!entity.properties?.extensions?.lpv_sncf;
}
