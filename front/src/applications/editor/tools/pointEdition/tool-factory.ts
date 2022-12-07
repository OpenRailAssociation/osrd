import { ComponentType } from 'react';
import { cloneDeep, isEqual, omit } from 'lodash';
import { Feature, LineString, Point } from 'geojson';
import { BiReset, AiOutlinePlus } from 'react-icons/all';
import { IconType } from 'react-icons';
import nearestPointOnLine from '@turf/nearest-point-on-line';

import { DEFAULT_COMMON_TOOL_STATE, LayerType, Tool } from '../types';
import { getNearestPoint } from '../../../../utils/mapboxHelper';
import { POINT_LAYER_ID, PointEditionLeftPanel, PointEditionMessages } from './components';
import { PointEditionState } from './types';
import { BufferStopEntity, DetectorEntity, SignalEntity } from '../../../../types';

type EditorPoint = BufferStopEntity | DetectorEntity | SignalEntity;
interface PointEditionToolParams<T extends EditorPoint> {
  layer: LayerType;
  icon: IconType;
  getNewEntity: (point?: [number, number]) => T;
  layersComponent: ComponentType;
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
        !editorState.editorZone ||
        !editorState.editorLayers.has('track_sections') ||
        !editorState.editorLayers.has(layer)
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
    onClickMap(_e, { setState, state }) {
      const { isHoveringTarget, entity, nearestPoint } = state;

      if (entity.geometry && isHoveringTarget) {
        setState({
          ...state,
          isHoveringTarget: false,
          entity: omit(entity, 'geometry') as T,
        });
      }

      if (!entity.geometry && nearestPoint) {
        const newEntity = cloneDeep(entity);
        newEntity.geometry = {
          type: 'Point',
          coordinates: nearestPoint.feature.geometry.coordinates,
        };
        newEntity.properties = newEntity.properties || {};
        newEntity.properties.position = nearestPoint.position;
        newEntity.properties.track = nearestPoint.trackSectionID;

        if (requiresAngle && newEntity.objType === 'Signal') {
          (newEntity as SignalEntity).properties.extensions.sncf.angle_geo = nearestPoint.angle;
        }

        setState({
          ...state,
          entity: newEntity,
          nearestPoint: null,
        });
      }
    },
    onHover(e, { setState, state, editorState: { entitiesIndex } }) {
      const { entity } = state;

      const hoveredTarget = (e.features || []).find((f) => f.layer.id === POINT_LAYER_ID);
      const hoveredTracks = (e.features || []).flatMap((f) => {
        if (f.layer.id !== 'editor/geo/track-main') return [];
        const trackEntity = entitiesIndex[(f.properties ?? {}).id];
        return trackEntity && trackEntity.objType === 'TrackSection' ? [trackEntity] : [];
      }) as Feature<LineString>[];

      if (!entity.geometry) {
        if (hoveredTracks.length) {
          const nearestPoint = getNearestPoint(hoveredTracks, e.lngLat.toArray());
          const angle = nearestPoint.properties.angleAtPoint;

          setState({
            ...state,
            nearestPoint: {
              angle,
              feature: nearestPoint,
              position: nearestPoint.properties.location,
              trackSectionID: hoveredTracks[nearestPoint.properties.featureIndex].id as string,
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
    onMount({ state: { entity }, editorState }) {
      const trackId = entity.properties?.track;

      if (trackId && editorState.entitiesIndex[trackId]) {
        const line = editorState.entitiesIndex[trackId];

        const dbPosition = entity.properties.position;
        const computedPosition = nearestPointOnLine(
          line as Feature<LineString>,
          entity as Feature<Point>,
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
      }
    },

    getInteractiveLayers() {
      return ['editor/geo/track-main', POINT_LAYER_ID];
    },
    getCursor({ state }, { isDragging }) {
      if (isDragging || !state.entity.geometry) return 'move';
      if (state.isHoveringTarget) return 'pointer';
      return 'default';
    },

    layersComponent,
    leftPanelComponent: PointEditionLeftPanel,
    messagesComponent: PointEditionMessages,
  };
}

export default getPointEditionTool;
