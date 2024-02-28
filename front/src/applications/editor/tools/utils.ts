import type { MapRef } from 'react-map-gl/maplibre';
import type { LngLatBoundsLike, MapLayerMouseEvent } from 'maplibre-gl';
import type { Dispatch } from 'redux';
import turfBbox from '@turf/bbox';
import length from '@turf/length';
import lineSlice from '@turf/line-slice';
import { featureCollection } from '@turf/helpers';
import type { NearestPoint } from '@turf/nearest-point';
import type { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import type { Feature, LineString, Point } from 'geojson';
import { uniq } from 'lodash';

import type {
  Bbox,
  BufferStopEntity,
  ElectrificationEntity,
  DetectorEntity,
  EditorEntity,
  RouteEntity,
  SignalEntity,
  SpeedSectionEntity,
  TrackNodeEntity,
  TrackSectionEntity,
} from 'types';
import { getEntity } from 'applications/editor/data/api';
import TOOL_TYPES from 'applications/editor/tools/toolTypes';
import { EDITOAST_TO_LAYER_DICT } from 'applications/editor/tools/types';
import type { TrackState } from 'applications/editor/tools/rangeEdition/types';
import type { EditoastType, EditorState } from 'applications/editor/tools/types';
import type { EditorContextType } from 'applications/editor/tools/editorContextTypes';
import { editorSliceActions } from 'reducers/editor';
import { getRouteEditionState } from './routeEdition/utils';

/**
 * Since Turf and Editoast do not compute the lengths the same way (see #1751)
 * we can have data "end" being larger than Turf's computed length, which
 * throws an error. Until we find a way to get similar computations, we can
 * approximate it with a rule of Three.
 *
 * This approximation is not good if the track is long.
 */
export function approximateDistanceWithEditoastData(track: TrackSectionEntity, point: Point) {
  const wrongDistanceAlongTrack = length(lineSlice(track.geometry.coordinates[0], point, track));
  const wrongTrackLength = length(track);
  const realTrackLength = track.properties.length;

  const distanceAlongTrack = (wrongDistanceAlongTrack * realTrackLength) / wrongTrackLength;

  if (Math.abs(distanceAlongTrack - realTrackLength) < 0.1) return realTrackLength;
  return Math.round(distanceAlongTrack * 100) / 100;
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
  const { switchTool, dispatch, editorState } = context;
  // call the switch tool
  switchTool({
    toolType: TOOL_TYPES.SELECTION,
    toolState: { selection: entities },
  });

  // enable the needed layer
  const actualLayers = editorState.editorLayers;

  // create the next list of layer
  const nextLayers = new Set(actualLayers);

  const neededLayers = getNeededLayers(entities);

  // iterate over needed layer
  neededLayers.forEach((l) => {
    if (!nextLayers.has(l)) nextLayers.add(l);
  });

  // dispatch the new layers
  if (actualLayers.size !== nextLayers.size) dispatch(editorSliceActions.selectLayers(nextLayers));
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
        toolType: TOOL_TYPES.TRACK_EDITION,
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
        toolType: TOOL_TYPES.SIGNAL_EDITION,
        toolState: {
          initialEntity: entity as SignalEntity,
          entity: entity as SignalEntity,
        },
      });
      break;
    case 'BufferStop':
      switchTool({
        toolType: TOOL_TYPES.BUFFER_STOP_EDITION,
        toolState: {
          initialEntity: entity as BufferStopEntity,
          entity: entity as BufferStopEntity,
        },
      });
      break;
    case 'Detector':
      switchTool({
        toolType: TOOL_TYPES.DETECTOR_EDITION,
        toolState: {
          initialEntity: entity as DetectorEntity,
          entity: entity as DetectorEntity,
        },
      });
      break;
    case 'TrackNode':
      switchTool({
        toolType: TOOL_TYPES.TRACK_NODE_EDITION,
        toolState: {
          initialEntity: entity as TrackNodeEntity,
          entity: entity as TrackNodeEntity,
        },
      });
      break;
    case 'SpeedSection':
      switchTool({
        toolType: TOOL_TYPES.SPEED_SECTION_EDITION,
        toolState: {
          initialEntity: entity as SpeedSectionEntity,
          entity: entity as SpeedSectionEntity,
        },
      });
      break;
    case 'Electrification':
      switchTool({
        toolType: TOOL_TYPES.ELECTRIFICATION_EDITION,
        toolState: {
          initialEntity: entity as ElectrificationEntity,
          entity: entity as ElectrificationEntity,
        },
      });
      break;
    case 'Route':
      switchTool({
        toolType: TOOL_TYPES.ROUTE_EDITION,
        toolState: getRouteEditionState(entity as RouteEntity),
      });
      break;
    default:
      break;
  }
}

/**
 * Given an array of editor entities, return the bbox which fits all of their geo elements.
 */
function getLargestBbox(entities: EditorEntity[]): BBox2d {
  const bboxList = entities.map((entity) => turfBbox(entity.geometry));

  let [minLeft, minBottom, minRight, minTop] = bboxList[0];

  bboxList.forEach(([left, bottom, right, top]) => {
    if (left < minLeft) minLeft = left;
    if (bottom < minBottom) minBottom = bottom;
    if (right > minRight) minRight = right;
    if (top > minTop) minTop = top;
  });
  return [minLeft, minBottom, minRight, minTop] as BBox2d;
}

/**
 * Given an array of editor entities, return the bbox that contains its geo element if possible depending the entities type.
 */
export async function getEntitiesBbox(
  infraId: number,
  entities: EditorEntity[],
  dispatch: Dispatch
): Promise<Bbox | null> {
  const hasRouteEntity = entities.some((entity) => entity.objType === 'Route');

  if (!hasRouteEntity) {
    let bbox = turfBbox(entities[0].geometry);
    if (entities.length > 1) bbox = getLargestBbox(entities);
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
  dispatch: Dispatch,
  mapRef: MapRef
): Promise<void> {
  // Center the map on the object
  const bbox = await getEntitiesBbox(infraId, entities, dispatch);
  if (bbox) {
    // zoom to the bbox
    mapRef.fitBounds(bbox as LngLatBoundsLike, { animate: false });
    // make a zoom out to have some kind of "margin" around the bbox
    mapRef.zoomOut();
  }
}
