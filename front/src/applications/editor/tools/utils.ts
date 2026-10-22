import turfBbox from '@turf/bbox';
import { featureCollection, type Units } from '@turf/helpers';
import length from '@turf/length';
import type { NearestPoint } from '@turf/nearest-point';
import type { Feature, LineString, Point } from 'geojson';
import { isEmpty, uniq } from 'lodash';
import type { LngLatBoundsLike, MapLayerMouseEvent } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Dispatch } from 'redux';

import { EDITOAST_TO_LAYER_DICT } from 'applications/editor/consts';
import type { EditoastType } from 'applications/editor/consts';
import { getEntity } from 'applications/editor/data/api';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import TOOL_NAMES from 'applications/editor/tools/constsToolNames';
import type { OpEntity } from 'applications/editor/tools/opEdition/types';
import type {
  BufferStopEntity,
  DetectorEntity,
  SignalEntity,
} from 'applications/editor/tools/pointEdition/types';
import type {
  ElectrificationEntity,
  SpeedSectionEntity,
  TrackState,
} from 'applications/editor/tools/rangeEdition/types';
import type { RouteEntity } from 'applications/editor/tools/routeEdition/types';
import { getRouteEditionState } from 'applications/editor/tools/routeEdition/utils';
import type { SwitchEntity } from 'applications/editor/tools/switchEdition/types';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import type { EditorContextType } from 'applications/editor/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import { type EditorState, editorSliceActions } from 'reducers/editor';
import type { AppDispatch } from 'store';
import type { Bbox } from 'types';
import { nearestPointOnLine } from 'utils/geometry';
import { getNearestPoint } from 'utils/mapHelper';

import { getLayerSettingNameFromEditorLayer } from '../utils';

/**
 * Since Turf and Editoast do not compute the lengths the same way (see #1751)
 * we can have data "end" being larger than Turf's computed length, which
 * throws an error. Until we find a way to get similar computations, we can
 * approximate it with a rule of Three.
 *
 * This approximation is not good if the track is long.
 * /!\ You can define the unit, be it MUST be the same as the one used in `track.properties.length`,
 * and of course the same as the offset
 */
export function approximateDistanceForEditoast(
  track: TrackSectionEntity,
  offset: number,
  units: Units = 'meters'
) {
  const geometryDistanceAlongTrack = offset;
  const geometryTrackLength = length(track, { units });
  const infraTrackLength = track.properties.length;
  const distanceAlongTrack = geometryDistanceAlongTrack * (infraTrackLength / geometryTrackLength);

  if (Math.abs(distanceAlongTrack - infraTrackLength) < 0.1) return infraTrackLength;
  return Math.round(distanceAlongTrack * 100) / 100;
}

/**
 * Compute the distance for editoast from the beginning of the track till the point.
 * /!\ You can define the unit, be it MUST be the same as the one used in `track.properties.length`
 */
export function approximatePointDistanceForEditoast(
  track: TrackSectionEntity,
  point: Point,
  units: Units = 'meters'
) {
  const pointOnLine = nearestPointOnLine(track.geometry, point, { units });
  const geometryDistanceAlongTrack = pointOnLine.properties.location;
  return approximateDistanceForEditoast(track, geometryDistanceAlongTrack, units);
}

/**
 * /!\ You can define the unit, be it MUST be the same as the one used in `track.properties.length`
 */
export function calculateDistanceAlongTrack(
  track: Feature<LineString>,
  point: Point,
  units: Units = 'meters'
) {
  return approximatePointDistanceForEditoast(track as TrackSectionEntity, point, units);
}

/** return the trackRanges near the mouse thanks to the hover event */
export function getHoveredTrackRanges(hoverEvent: MapLayerMouseEvent) {
  const { point, target: map } = hoverEvent;
  const TOLERANCE = 20;

  return map.queryRenderedFeatures(
    [
      [point.x - TOLERANCE / 2, point.y - TOLERANCE / 2],
      [point.x + TOLERANCE / 2, point.y + TOLERANCE / 2],
    ],
    {
      layers: ['editor/geo/track-main'],
    }
  ) as Feature<LineString>[];
}

/**
 * Given a point and trackSectionsCache, return the cached trackSection on which the point is.
 * If the trackSection is not in the cache, then return null.
 */
export function getTrackSectionEntityFromNearestPoint(
  point: NearestPoint,
  trackRanges: Feature<LineString>[],
  trackSectionsCache: Record<string, TrackState>
) {
  const currentTrackRange = trackRanges[point.properties.featureIndex];
  if (!currentTrackRange.id) return null;
  const trackState = trackSectionsCache[currentTrackRange.id];
  if (trackState?.type !== 'success') return null;
  const { track } = trackState;
  return track;
}

/**
 * Given a mouse event and a trackSectionsCache, return the position under the mouse, as the id of
 * the nearest cached track section and the distance from its beginning.
 * - retrieve the trackRanges around the mouse
 * - retrieve the nearest point of the mouse (and the trackRange it belongs to)
 * - compute the distance between the beginning of the track and the nearest point (with approximation because of Editoast data)
 */
export function getTrackPositionFromEvent(
  e: MapLayerMouseEvent,
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
  const distanceAlongTrack = approximatePointDistanceForEditoast(
    trackSection,
    nearestPoint.geometry
  );
  return { track: trackSection.properties.id, position: distanceAlongTrack };
}

function getNeededLayers(entities: EditorEntity[]) {
  const objectTypes = uniq(entities.map((entity) => entity.objType));
  return uniq(
    objectTypes.flatMap((objectType) => EDITOAST_TO_LAYER_DICT[objectType as EditoastType])
  );
}

export function selectEntities(
  entities: EditorEntity[],
  context: {
    switchTool: EditorContextType['switchTool'];
    dispatch: Dispatch;
    editorState: EditorState;
  }
): void {
  const {
    switchTool,
    dispatch,
    editorState: {
      mapSettings: { layersSettings },
    },
  } = context;
  // call the switch tool
  switchTool({
    toolType: TOOL_NAMES.SELECTION,
    toolState: { selection: entities },
  });

  // iterate over needed layers to activate them if needed
  const neededEditorLayers = getNeededLayers(entities);

  const newLayers = { ...layersSettings };
  neededEditorLayers.forEach((editorLayer) => {
    const layer = getLayerSettingNameFromEditorLayer(editorLayer);
    if (layer && layer !== 'speedlimittag') newLayers[layer] = true;
  });

  dispatch(editorSliceActions.updateMapSettings({ layersSettings: newLayers }));
}

/**
 * Given an editor entity, try to open its edition panel.
 */
export function openEntityEditionPanel(
  entity: EditorEntity,
  context: { switchTool: EditorContextType['switchTool'] }
): void {
  const { switchTool } = context;
  switch (entity.objType) {
    case 'TrackSection':
      switchTool({
        toolType: TOOL_NAMES.TRACK_EDITION,
        toolState: {
          initialTrack: entity as TrackSectionEntity,
          track: entity as TrackSectionEntity,
          editionState: {
            type: 'movePoint',
          },
        },
      });
      break;
    case 'Signal':
      switchTool({
        toolType: TOOL_NAMES.SIGNAL_EDITION,
        toolState: {
          initialEntity: entity as SignalEntity,
          entity: entity as SignalEntity,
        },
      });
      break;
    case 'BufferStop':
      switchTool({
        toolType: TOOL_NAMES.BUFFER_STOP_EDITION,
        toolState: {
          initialEntity: entity as BufferStopEntity,
          entity: entity as BufferStopEntity,
        },
      });
      break;
    case 'Detector':
      switchTool({
        toolType: TOOL_NAMES.DETECTOR_EDITION,
        toolState: {
          initialEntity: entity as DetectorEntity,
          entity: entity as DetectorEntity,
        },
      });
      break;
    case 'Switch':
      switchTool({
        toolType: TOOL_NAMES.SWITCH_EDITION,
        toolState: {
          initialEntity: entity as SwitchEntity,
          entity: entity as SwitchEntity,
        },
      });
      break;
    case 'SpeedSection':
      switchTool({
        toolType: TOOL_NAMES.SPEED_SECTION_EDITION,
        toolState: {
          initialEntity: entity as SpeedSectionEntity,
          entity: entity as SpeedSectionEntity,
        },
      });
      break;
    case 'Electrification':
      switchTool({
        toolType: TOOL_NAMES.ELECTRIFICATION_EDITION,
        toolState: {
          initialEntity: entity as ElectrificationEntity,
          entity: entity as ElectrificationEntity,
        },
      });
      break;
    case 'Route':
      switchTool({
        toolType: TOOL_NAMES.ROUTE_EDITION,
        toolState: getRouteEditionState(entity as RouteEntity),
      });
      break;
    case 'OperationalPoint':
      switchTool({
        toolType: TOOL_NAMES.OP_EDITION,
        toolState: {
          initialEntity: entity as OpEntity,
          entity: entity as OpEntity,
        },
      });
      break;
    default:
      break;
  }
}

/**
 * Given an array of editor entities, return the bbox that contains its geo element if possible depending the entities type.
 */
export async function getEntitiesBbox(
  infraId: number,
  entities: EditorEntity[],
  dispatch: AppDispatch
): Promise<Bbox | null> {
  const hasRouteEntity = entities.some((entity) => entity.objType === 'Route');

  if (!hasRouteEntity) {
    const bbox = turfBbox(featureCollection(entities));
    if (!bbox.every(Number.isFinite)) return null;
    return [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ];
  }

  if (entities.length === 1 && entities[0].objType === 'Route') {
    // get start point
    const { id: startPointId, type: startPointIdType } = entities[0].properties.entry_point;
    const startPoint = await getEntity(infraId, startPointId, startPointIdType, dispatch);
    // get end point
    const { id: endPointId, type: endPointIdType } = entities[0].properties.exit_point;
    const endPoint = await getEntity(infraId, endPointId, endPointIdType, dispatch);

    const fc = featureCollection([startPoint, endPoint]);
    const bbox = turfBbox(fc);
    return [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ];
  }
  return null;
}

export async function centerMapOnObject(
  infraId: number,
  entities: EditorEntity[],
  dispatch: AppDispatch,
  mapRef: MapRef
): Promise<void> {
  // Center the map on the object
  const bbox = await getEntitiesBbox(infraId, entities, dispatch);
  if (bbox) {
    // Zoom to the bbox with padding added (in pixels)
    mapRef.fitBounds(bbox as LngLatBoundsLike, { padding: 40, animate: false });
  }
}

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
