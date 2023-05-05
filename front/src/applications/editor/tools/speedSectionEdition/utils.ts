import { Position } from 'geojson';
import { last, cloneDeep, compact, isEmpty } from 'lodash';
import along from '@turf/along';
import length from '@turf/length';
import { Feature, feature, lineString, LineString, point } from '@turf/helpers';
import lineSliceAlong from '@turf/line-slice-along';

import { getNearestPoint } from 'utils/mapboxHelper';
import { NEW_ENTITY_ID } from '../../data/utils';
import { DEFAULT_COMMON_TOOL_STATE, Reducer } from '../types';
import {
  LPVExtension,
  LPVPanel,
  SpeedSectionEntity,
  SpeedSectionLpvEntity,
  TrackRange,
  TrackSectionEntity,
} from '../../../../types';
import {
  LPV_PANEL_TYPE,
  LPV_PANEL_TYPES,
  LpvPanelFeature,
  LpvPanelInformation,
  SpeedSectionEditionState,
  TrackRangeExtremityFeature,
  TrackRangeFeature,
  TrackState,
} from './types';
import {
  approximateDistanceWithEditoastData,
  getHoveredTrackRanges,
  getTrackSectionEntityFromNearestPoint,
} from '../utils';

// Tool functions
/**
 * Given a hover event and a trackSectionCache when moving a LpvPanel, return the new position of the panel, with the trackRange's id on which the panel is and its distance from the beginning of the trackRange.
 * - retrieve the trackRanges around the mouse
 * - retrieve the nearest point of the mouse (and the trackRange it belongs to)
 * - compute the distance between the beginning of the track and the nearest point (with approximation because of Editoast data)
 */
export function getLpvPanelNewPosition(
  e: mapboxgl.MapLayerMouseEvent,
  trackSectionsCache: Record<string, TrackState>
) {
  const hoveredTrackRanges = getHoveredTrackRanges(e);
  if (isEmpty(hoveredTrackRanges)) {
    return null;
  }
  const nearestPoint = getNearestPoint(hoveredTrackRanges, e.lngLat.toArray());
  const trackSection = getTrackSectionEntityFromNearestPoint(
    nearestPoint,
    hoveredTrackRanges,
    trackSectionsCache
  );
  if (!trackSection) {
    return null;
  }
  const distanceAlongTrack = approximateDistanceWithEditoastData(
    trackSection,
    nearestPoint.geometry
  );
  return { trackId: trackSection.properties.id, position: distanceAlongTrack };
}

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

/** return the LPV panel type and its index (if the panel is not a Z panel) */
export function getPanelInformationFromInteractionState(
  interactionState: { type: 'movePanel' } & LpvPanelInformation
) {
  const { panelType } = interactionState;
  return (
    panelType === LPV_PANEL_TYPES.Z
      ? { panelType: LPV_PANEL_TYPES.Z }
      : { panelType, panelIndex: interactionState.panelIndex }
  ) as LpvPanelInformation;
}

export function getNewLpvExtension(
  newLpvExtension: LPVExtension,
  panelInformation: LpvPanelInformation,
  newPosition: { trackId: string; position: number }
) {
  const { panelType } = panelInformation;
  if (panelType === LPV_PANEL_TYPES.Z) {
    newLpvExtension.z = {
      ...newLpvExtension.z,
      ...newPosition,
    };
  } else {
    const { panelIndex } = panelInformation;
    if (panelType === LPV_PANEL_TYPES.ANNOUNCEMENT) {
      newLpvExtension.announcement[panelIndex] = {
        ...newLpvExtension.announcement[panelIndex],
        ...newPosition,
      };
    } else {
      newLpvExtension.r[panelIndex] = {
        ...newLpvExtension.r[panelIndex],
        ...newPosition,
      };
    }
  }
  return newLpvExtension;
}

export function getMovedLpvEntity(
  entity: SpeedSectionLpvEntity,
  panelInfo: LpvPanelInformation,
  newPosition: { trackId: string; position: number }
) {
  const newLpvExtension = getNewLpvExtension(
    cloneDeep(entity.properties.extensions.lpv_sncf),
    panelInfo,
    newPosition
  );
  const updatedEntity = cloneDeep(entity);
  updatedEntity.properties.extensions.lpv_sncf = newLpvExtension;
  return updatedEntity;
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
  panelIndex: number,
  panelType: LPV_PANEL_TYPE,
  trackSectionsCache: Record<string, TrackState>
): LpvPanelFeature | null {
  const trackState = trackSectionsCache[panel.track];
  if (trackState?.type !== 'success') {
    return null;
  }
  const panelPoint = along(trackState.track, panel.position, { units: 'meters' });
  panelPoint.properties = {
    ...panel,
    speedSectionItemType: 'LPVPanel',
    speedSectionPanelIndex: panelIndex,
    speedSectionPanelType: panelType,
  };
  return panelPoint as LpvPanelFeature;
}

/** Generate LPV panel Features (Point) from LPV panels and trackSectionCache */
export function generateLpvPanelFeatures(
  lpv: LPVExtension,
  trackSectionsCache: Record<string, TrackState>
) {
  const panelsLists = [
    { type: LPV_PANEL_TYPES.Z, panels: lpv.z ? [lpv.z] : [] },
    { type: LPV_PANEL_TYPES.R, panels: lpv.r },
    { type: LPV_PANEL_TYPES.ANNOUNCEMENT, panels: lpv.announcement },
  ];
  const panelPoints = panelsLists.flatMap(({ type, panels }) =>
    panels.map((panel, i) => generatePointFromLPVPanel(panel, i, type, trackSectionsCache))
  );
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

export function clickOnLpvPanel(
  lpvPanel: LpvPanelFeature,
  setState: (
    stateOrReducer: Partial<SpeedSectionEditionState> | Reducer<SpeedSectionEditionState>
  ) => void
) {
  const {
    properties: { speedSectionPanelType, speedSectionPanelIndex },
  } = lpvPanel;
  const interactionState =
    speedSectionPanelType === LPV_PANEL_TYPES.Z
      ? ({ type: 'movePanel', panelType: LPV_PANEL_TYPES.Z } as {
          type: 'movePanel';
          panelType: LPV_PANEL_TYPES.Z;
        })
      : ({
          type: 'movePanel',
          panelType: speedSectionPanelType,
          panelIndex: speedSectionPanelIndex,
        } as {
          type: 'movePanel';
          panelType: LPV_PANEL_TYPES.ANNOUNCEMENT | LPV_PANEL_TYPES.R;
          panelIndex: number;
        });
  setState({
    hoveredItem: null,
    interactionState,
  });
}

export function speedSectionIsLpv(entity: SpeedSectionEntity): boolean {
  return !!entity.properties?.extensions?.lpv_sncf;
}
