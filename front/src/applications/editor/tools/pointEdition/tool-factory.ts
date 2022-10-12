import { ComponentType } from 'react';
import { cloneDeep, isEqual, omit } from 'lodash';
import { Feature, LineString, Point } from 'geojson';
import { BiReset, AiOutlinePlus } from 'react-icons/all';
import { IconType } from 'react-icons';
import nearestPointOnLine from '@turf/nearest-point-on-line';

import { DEFAULT_COMMON_TOOL_STATE, LayerType, MakeOptional, Tool } from '../types';
import { getNearestPoint } from '../../../../utils/mapboxHelper';
import { POINT_LAYER_ID, PointEditionLeftPanel } from './components';
import { PointEditionState } from './types';
import { EditorEntity } from '../../../../types';

interface PointEditionToolParams<Entity extends EditorEntity> {
  layer: LayerType;
  icon: IconType;
  getNewEntity: (point?: [number, number]) => MakeOptional<Entity, 'geometry'>;
  layersComponent: ComponentType;
  requiresAngle?: boolean;
}

function getPointEditionTool<
  Entity extends EditorEntity<
    Point,
    { track?: { id: string; type: string }; position?: number; angle_geo?: number }
  >
>({
  layer,
  icon,
  getNewEntity,
  layersComponent,
  requiresAngle,
}: PointEditionToolParams<Entity>): Tool<PointEditionState<Entity>> {
  const id = layer.replace(/_/g, '-').replace(/s$/, '');

  function getInitialState(): PointEditionState<Entity> {
    const entity = getNewEntity();
    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      entity,
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
    getRadius() {
      return 20;
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
          entity: omit(entity, 'geometry') as Entity,
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
        newEntity.properties.track = { id: nearestPoint.trackSectionID, type: 'TrackSection' };

        if (requiresAngle) {
          newEntity.properties.angle_geo = nearestPoint.angle;
        }

        setState({
          ...state,
          entity: newEntity,
          nearestPoint: null,
        });
      }
    },
    onHover(e, { setState, state, editorState: { editorDataIndex } }) {
      const { entity } = state;

      const hoveredTarget = (e.features || []).find((f) => f.layer.id === POINT_LAYER_ID);
      const hoveredTracks = (e.features || []).flatMap((f) => {
        if (f.layer.id !== 'editor/geo/track-main') return [];
        const trackEntity = editorDataIndex[f.properties.id];
        return trackEntity && trackEntity.objType === 'TrackSection' ? [trackEntity] : [];
      }) as Feature<LineString>[];

      if (!entity.geometry) {
        if (hoveredTracks.length) {
          const nearestPoint = getNearestPoint(hoveredTracks, e.lngLat);
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
      const trackId = entity.properties?.track?.id;

      if (trackId) {
        const line = editorState.editorDataIndex[trackId];

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
The entity ${entity.id} position computed by Turf.js does not match the one from the database:
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
  };
}

export default getPointEditionTool;
