import { type ComponentType } from 'react';

import { PlusCircle, Trash } from '@osrd-project/ui-icons';
import type { Feature, LineString, Point } from 'geojson';
import { cloneDeep, isEqual, omit } from 'lodash';
import type { Map } from 'maplibre-gl';
import type { IconType } from 'react-icons';
import { AiFillSave } from 'react-icons/ai';
import { BiReset } from 'react-icons/bi';

import { LAYER_TO_EDITOAST_DICT, type Layer } from 'applications/editor/consts';
import { getEntity } from 'applications/editor/data/api';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import { DEFAULT_COMMON_TOOL_STATE } from 'applications/editor/tools/consts';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import { calculateDistanceAlongTrack } from 'applications/editor/tools/utils';
import type { Tool } from 'applications/editor/types';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';
import { save } from 'reducers/editor/thunkActions';
import { NULL_GEOMETRY } from 'types';
import { nearestPointOnLine } from 'utils/geometry';
import { getNearestPoint } from 'utils/mapHelper';

import { PointEditionMessages, getPointEditionLeftPanel } from './components';
import { POINT_LAYER_ID } from './consts';
import type { BufferStopEntity, DetectorEntity, PointEditionState, SignalEntity } from './types';

type EditorPoint = BufferStopEntity | DetectorEntity | SignalEntity;
type PointEditionToolParams<T extends EditorPoint> = {
  layer: Layer;
  icon: IconType;
  getNewEntity: (point?: [number, number]) => T;
  layersComponent: ComponentType<{ map: Map }>;
  requiresAngle?: boolean;
};

function getPointEditionTool<T extends EditorPoint>({
  layer,
  icon,
  getNewEntity,
  layersComponent,
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
          id: 'save-entity',
          icon: AiFillSave,
          labelTranslationKey: `Editor.tools.${id}-edition.actions.save-entity`,
          isDisabled({ isLoading, isInfraLocked, state }) {
            return (
              !state.entity.properties?.track ||
              !state.entity.geometry ||
              isLoading ||
              isInfraLocked ||
              false
            );
          },
          async onClick({ setIsFormSubmited }) {
            if (setIsFormSubmited) {
              setIsFormSubmited(true);
            }
          },
        },
        {
          id: 'reset-entity',
          icon: BiReset,
          labelTranslationKey: `Editor.tools.${id}-edition.actions.reset-entity`,
          isDisabled({ state: { entity, initialEntity } }) {
            return isEqual(entity, initialEntity);
          },
          onClick({ setState, state: { initialEntity } }) {
            const entity = cloneDeep(initialEntity);
            // We set the initialEntity, so its ref changes and the form is remounted
            setState({
              entity,
              initialEntity: entity,
            });
          },
        },
      ],
      [
        {
          id: 'new-entity',
          icon: PlusCircle,
          labelTranslationKey: `Editor.tools.${id}-edition.actions.new-entity`,
          onClick({ setState }) {
            setState(getInitialState());
          },
        },
      ],
      [
        {
          id: 'delete-entity',
          icon: Trash,
          labelTranslationKey: `Editor.tools.${id}-edition.actions.delete-entity`,
          // Show button only if we are editing
          isDisabled({ state }) {
            return state.initialEntity.properties.id === NEW_ENTITY_ID;
          },
          onClick({ infraID, openModal, closeModal, forceRender, state, setState, dispatch, t }) {
            openModal(
              <ConfirmModal
                title={t(`Editor.tools.${id}-edition.actions.delete-entity`)}
                onConfirm={async () => {
                  await dispatch(
                    // We have to put state.initialEntity in array because delete initially works with selection which can get multiple elements
                    save(infraID, { delete: [state.initialEntity] })
                  );
                  setState(getInitialState());
                  closeModal();
                  forceRender();
                }}
              >
                <p>{t(`Editor.tools.${id}-edition.actions.confirm-delete-entity`).toString()}</p>
              </ConfirmModal>
            );
          },
        },
      ],
    ],

    // Interactions:
    getCursor({ state }, { isDragging }) {
      if (isDragging || !state.entity.geometry || isEqual(state.entity.geometry, NULL_GEOMETRY))
        return 'grabbing';
      if (state.isHoveringTarget) return 'pointer';
      return 'default';
    },
    onClickMap(_e, { setState, state, infraID, dispatch }) {
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

        getEntity(infraID as number, newEntity.properties.track, 'TrackSection', dispatch).then(
          (track) => {
            const distanceAlongTrack = calculateDistanceAlongTrack(
              track as TrackSectionEntity,
              newEntity.geometry as Point
            );
            newEntity.properties.position = distanceAlongTrack;

            setState({
              ...state,
              entity: newEntity,
              nearestPoint: null,
            });
          }
        );
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
    onMount({ state: { entity }, infraID, dispatch }) {
      const trackId = entity.properties?.track;

      if (typeof trackId !== 'string') return;

      getEntity(infraID as number, trackId, 'TrackSection', dispatch).then((track) => {
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

    layersComponent,
    leftPanelComponent: getPointEditionLeftPanel(LAYER_TO_EDITOAST_DICT[layer]),
    messagesComponent: PointEditionMessages,
  };
}

export default getPointEditionTool;
