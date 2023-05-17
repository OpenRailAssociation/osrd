import { Position } from 'geojson';
import { last, cloneDeep, compact, isEmpty } from 'lodash';
import along from '@turf/along';
import length from '@turf/length';
import { Feature, feature, lineString, LineString, point } from '@turf/helpers';
import lineSliceAlong from '@turf/line-slice-along';

import { getNearestPoint } from 'utils/mapboxHelper';
import { NEW_ENTITY_ID } from '../../data/utils';
import {
  CatenaryEntity,
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
  RangeEditionState,
  // SpeedSectionEditionState,
  TrackRangeExtremityFeature,
  TrackRangeFeature,
  TrackState,
} from './types';
import {
  approximateDistanceWithEditoastData,
  getHoveredTrackRanges,
  getTrackSectionEntityFromNearestPoint,
} from '../utils';
import { DEFAULT_COMMON_TOOL_STATE } from '../commonToolState';
import { PartialOrReducer } from '../editorContextTypes';

// Tool functions

export function getNewCatenary(): CatenaryEntity {
  return {
    type: 'Feature',
    objType: 'Catenary',
    properties: {
      id: NEW_ENTITY_ID,
      track_ranges: [],
      voltage: '',
    },
    geometry: {
      type: 'MultiLineString',
      coordinates: [],
    },
  };
}

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
  return { track: trackSection.properties.id, position: distanceAlongTrack };
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
  newPosition: { track: string; position: number }
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
  newPosition: { track: string; position: number }
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

export function getEditSpeedSectionState(
  entity: SpeedSectionEntity
): RangeEditionState<SpeedSectionEntity> {
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

/**
 * Given a LPV panel and the cached trackSections, generate a point feature to represent a SpeedSection Lpv Panel.
 * If the panel's track is not in the trackSectionsCache object, then return null.
 * This feature will be used to display the panel on the map.
 */
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

/**
 * Given a LPV extension and cached trackSections, generate an array of Point Features to display the LPV panels on the map.
 */
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

/**
 * Given a lpvPanel information, update the state to notify that the user is moving the panel.
 * - set the interaction state on 'movePanel'
 * - store in the interaction state the panel informations
 */
export function selectLpvPanel(
  lpvPanel: LpvPanelInformation,
  setState: (stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>) => void
) {
  const { panelType } = lpvPanel;
  const interactionState =
    panelType === LPV_PANEL_TYPES.Z
      ? ({ type: 'movePanel', panelType: LPV_PANEL_TYPES.Z } as {
          type: 'movePanel';
          panelType: LPV_PANEL_TYPES.Z;
        })
      : ({
          type: 'movePanel',
          panelType,
          panelIndex: lpvPanel.panelIndex,
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

export function isOnModeMove(interactionStateType: string): boolean {
  return ['moveRangeExtremity', 'movePanel'].includes(interactionStateType);
}
