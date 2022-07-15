import { ComponentType } from 'react';
import { cloneDeep, isEqual, omit } from 'lodash';
import { Feature, LineString, Point } from 'geojson';
import { BiReset, AiOutlinePlus } from 'react-icons/all';
import { IconType } from 'react-icons';

import { DEFAULT_COMMON_TOOL_STATE, MakeOptional, Tool } from '../types';
import { getNearestPoint } from '../../../../utils/mapboxHelper';
import { POINT_LAYER_ID, PointEditionLeftPanel } from './components';
import { PointEditionState } from './types';
import { EditorEntity } from '../../../../types';

interface PointEditionToolParams<Entity extends EditorEntity> {
  id: string;
  icon: IconType;
  getNewEntity: (point?: [number, number]) => MakeOptional<Entity, 'geometry'>;
  layersComponent: ComponentType;
  requiresAngle?: boolean;
}

function getPointEditionTool<
  Entity extends EditorEntity<Point, { track?: { id: string; type: string }; angle_geo?: number }>
>({
  id,
  icon,
  getNewEntity,
  layersComponent,
  requiresAngle,
}: PointEditionToolParams<Entity>): Tool<PointEditionState<Entity>> {
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
    isDisabled({ editorState }) {
      return !editorState.editorZone;
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
