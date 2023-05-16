import { ComponentType } from 'react';
import { cloneDeep, isEqual, omit } from 'lodash';
import { Feature, LineString, Point } from 'geojson';
import { BiReset, AiOutlinePlus } from 'react-icons/all';
import { IconType } from 'react-icons';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import mapboxgl from 'mapbox-gl';

import { LAYER_TO_EDITOAST_DICT, LayerType } from '../types';
import { getNearestPoint } from '../../../../utils/mapboxHelper';
import { getPointEditionLeftPanel, POINT_LAYER_ID, PointEditionMessages } from './components';
import { PointEditionState } from './types';
import { NULL_GEOMETRY, BufferStopEntity, DetectorEntity, SignalEntity } from '../../../../types';
import { getEntity } from '../../data/api';
import { Tool } from '../editorContextTypes';
import { DEFAULT_COMMON_TOOL_STATE } from '../commonToolState';

type EditorPoint = BufferStopEntity | DetectorEntity | SignalEntity;
interface PointEditionToolParams<T extends EditorPoint> {
  layer: LayerType;
  icon: IconType;
  getNewEntity: (point?: [number, number]) => T;
  layersComponent: ComponentType<{ map: mapboxgl.Map }>;
  requiresAngle?: boolean;
}

function getPointEditionTool<T extends EditorPoint>({
  layer,
  icon,
  getNewEntity,
  layersComponent,
  requiresAngle,
}: PointEditionToolParams<T>): Tool<PointEditionState<T>> {
  const id = layer.replace(/_/g, '-').replace(/s$/, '');

  function getInitialState(): PointEditionState<T> {
    const entity = getNewEntity();
    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      entity,
      objType: layer,
      initialEntity: entity,
      nearestPoint: null,
    };
  }

  return {
    id: `${id}-edition`,
    icon,
    labelTranslationKey: `Editor.tools.${id}-edition.label`,
    requiredLayers: new Set([layer, 'track_sections']),
    isDisabled({ editorState }) {
      return (
        !editorState.editorLayers.has('track_sections') || !editorState.editorLayers.has(layer)
      );
    },
    getInitialState,
    actions: [
      [
        {
          id: 'reset-entity',
          icon: BiReset,
          labelTranslationKey: `Editor.tools.${id}-edition.actions.reset-entity`,
          onClick({ setState, state }) {
            setState({
              ...getInitialState(),
              entity: state.initialEntity,
            });
          },
          isDisabled({ state }) {
            return isEqual(state.entity, state.initialEntity);
          },
        },
        {
          id: 'new-entity',
          icon: AiOutlinePlus,
          labelTranslationKey: `Editor.tools.${id}-edition.actions.new-entity`,
          onClick({ setState }) {
            setState(getInitialState());
          },
        },
      ],
    ],

    // Interactions:
    onClickMap(_e, { setState, state, infraID }) {
      const { isHoveringTarget, entity, nearestPoint } = state;
      if (entity.geometry && !isEqual(entity.geometry, NULL_GEOMETRY) && isHoveringTarget) {
        setState({
          ...state,
          isHoveringTarget: false,
          entity: omit(entity, 'geometry') as T,
        });
      }

      if ((!entity.geometry || isEqual(entity.geometry, NULL_GEOMETRY)) && nearestPoint) {
        const newEntity = cloneDeep(entity);
        newEntity.geometry = {
          type: 'Point',
          coordinates: nearestPoint.feature.geometry.coordinates,
        };
        newEntity.properties = newEntity.properties || {};
        newEntity.properties.track = nearestPoint.trackSectionID;

        if (requiresAngle && newEntity.objType === 'Signal') {
          (newEntity as SignalEntity).properties.extensions.sncf.angle_geo = nearestPoint.angle;
        }

        // retrieve the track section to be sure that the computation of the distance will be good
        // we can't trust maplibre, because the stored gemetry is not necessary the real one
        getEntity(infraID as number, newEntity.properties.track, 'TrackSection').then((track) => {
          newEntity.properties.position = nearestPointOnLine(
            (track as Feature<LineString>).geometry,
            newEntity.geometry as Point,
            { units: 'meters' }
          ).properties?.location;

          setState({
            ...state,
            entity: newEntity,
            nearestPoint: null,
          });
        });
      }
    },
    onMove(e, { setState, state }) {
      const { entity } = state;
      const { point, target: map } = e;
      const TOLERANCE = 20;

      const hoveredTracks = map.queryRenderedFeatures(
        [
          [point.x - TOLERANCE / 2, point.y - TOLERANCE / 2],
          [point.x + TOLERANCE / 2, point.y + TOLERANCE / 2],
        ],
        {
          layers: ['editor/geo/track-main'],
        }
      ) as Feature<LineString>[];
      const hoveredTarget = map.queryRenderedFeatures(
        [
          [point.x - TOLERANCE / 2, point.y - TOLERANCE / 2],
          [point.x + TOLERANCE / 2, point.y + TOLERANCE / 2],
        ],
        {
          layers: [POINT_LAYER_ID],
        }
      );

      if (!entity.geometry || isEqual(entity.geometry, NULL_GEOMETRY)) {
        if (hoveredTracks.length) {
          const nearestPoint = getNearestPoint(hoveredTracks, e.lngLat.toArray());
          const angle = nearestPoint.properties.angleAtPoint;

          setState({
            ...state,
            nearestPoint: {
              angle,
              feature: nearestPoint,
              trackSectionID: hoveredTracks[nearestPoint.properties.featureIndex].properties?.id,
            },
          });
        } else {
          setState({
            ...state,
            nearestPoint: null,
          });
        }
      } else if (hoveredTarget) {
        setState({
          ...state,
          isHoveringTarget: true,
        });
      } else {
        setState({
          ...state,
          isHoveringTarget: false,
        });
      }
    },

    // Lifecycle:
    onMount({ state: { entity }, infraID }) {
      const trackId = entity.properties?.track;

      if (typeof trackId !== 'string') return;

      getEntity(infraID as number, trackId, 'TrackSection').then((track) => {
        const dbPosition = entity.properties.position;
        const computedPosition = nearestPointOnLine(
          (track as Feature<LineString>).geometry,
          (entity as Feature<Point>).geometry,
          { units: 'meters' }
        ).properties?.location;

        if (
          typeof dbPosition === 'number' &&
          typeof computedPosition === 'number' &&
          Math.abs(dbPosition - computedPosition) >= 1
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            `
      The entity ${entity.properties.id} position computed by Turf.js does not match the one from the database:
        -> Database position: ${dbPosition}
        -> Turf.js position: ${computedPosition}
      `
          );
        }
      });
    },

    getInteractiveLayers() {
      return ['editor/geo/track-main', POINT_LAYER_ID];
    },
    getCursor({ state }, { isDragging }) {
      if (isDragging || !state.entity.geometry || isEqual(state.entity.geometry, NULL_GEOMETRY))
        return 'move';
      if (state.isHoveringTarget) return 'pointer';
      return 'default';
    },

    layersComponent,
    leftPanelComponent: getPointEditionLeftPanel(LAYER_TO_EDITOAST_DICT[layer]),
    messagesComponent: PointEditionMessages,
  };
}

export default getPointEditionTool;
