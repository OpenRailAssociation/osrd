import React, { ComponentType } from 'react';
import { Map } from 'maplibre-gl';
import { cloneDeep, isEqual } from 'lodash';
import { IconType } from 'react-icons';
import { BiReset } from 'react-icons/bi';
import { AiFillSave } from 'react-icons/ai';
import { GoPlusCircle, GoTrash } from 'react-icons/go';

import { save } from 'reducers/editor';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';
import {
  ElectrificationEntity,
  SpeedSectionEntity,
  SpeedSectionPslEntity,
  TrackSectionEntity,
} from 'types/editor';
import { getNearestPoint } from 'utils/mapHelper';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import { PartialOrReducer, ReadOnlyEditorContextType, Tool } from '../editorContextTypes';
import { DEFAULT_COMMON_TOOL_STATE } from '../commonToolState';
import { approximateDistanceWithEditoastData } from '../utils';
import { LAYER_TO_EDITOAST_DICT, LAYERS_SET, LayerType } from '../types';
import {
  HoveredExtremityState,
  HoveredSignState,
  HoveredRangeState,
  PslSignFeature,
  RangeEditionState,
  TrackRangeExtremityFeature,
  TrackRangeFeature,
} from './types';
import {
  getPslSignNewPosition,
  getMovedPslEntity,
  getSignInformationFromInteractionState,
  isOnModeMove,
  selectPslSign,
  getObjTypeAction,
  getObjTypeEdition,
  isNew,
} from './utils';

type EditorRange = SpeedSectionEntity | ElectrificationEntity;
interface RangeEditionToolParams<T extends EditorRange> {
  id: T['objType'];
  icon: IconType;
  getNewEntity: () => T;
  messagesComponent: ComponentType;
  layersComponent: ComponentType<{ map: Map }>;
  leftPanelComponent: ComponentType;
  canSave?: (state: RangeEditionState<T>) => boolean;
  getEventsLayers?: (context: ReadOnlyEditorContextType<RangeEditionState<T>>) => string[];
}

function getRangeEditionTool<T extends EditorRange>({
  id,
  icon,
  getNewEntity,
  messagesComponent,
  layersComponent,
  leftPanelComponent,
  canSave,
  getEventsLayers,
}: RangeEditionToolParams<T>): Tool<RangeEditionState<T>> {
  const layersEntity = getNewEntity();
  function getInitialState(): RangeEditionState<T> {
    const entity = getNewEntity();
    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      entity,
      initialEntity: entity,
      hoveredItem: null,
      interactionState: { type: 'idle' },
      trackSectionsCache: {},
    };
  }

  const objectTypeEdition = getObjTypeEdition(layersEntity.objType);
  const objectTypeAction = getObjTypeAction(layersEntity.objType);

  return {
    id,
    icon,
    labelTranslationKey: `Editor.tools.${objectTypeEdition}-edition.label`,
    requiredLayers: new Set(
      layersEntity.objType === 'SpeedSection'
        ? ['speed_sections', 'psl', 'psl_signs']
        : ['electrifications']
    ),
    getInitialState,

    actions: [
      [
        {
          id: `save-${objectTypeAction}`,
          icon: AiFillSave,
          labelTranslationKey: `Editor.tools.${objectTypeEdition}-edition.actions.save-${objectTypeAction}`,
          isDisabled({ isLoading, state }) {
            if (isLoading) return true;
            if (canSave) return !canSave(state);
            return false;
          },
          async onClick({ state, setState, dispatch, infraID }) {
            const { initialEntity, entity } = state;
            if (!isEqual(entity, initialEntity)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const res: any = await dispatch(
                save(
                  infraID,
                  !isNew(entity)
                    ? {
                        update: [
                          {
                            source: initialEntity,
                            target: entity,
                          },
                        ],
                      }
                    : { create: [entity] }
                )
              );
              const { railjson } = res[0];
              const { id: entityId } = railjson;

              const savedEntity =
                entityId && entityId !== entity.properties.id
                  ? {
                      ...entity,
                      properties: { ...entity.properties, id: `${entityId}` },
                    }
                  : entity;
              setState({
                entity: cloneDeep(savedEntity),
                initialEntity: cloneDeep(savedEntity),
              });
            }
          },
        },
        {
          id: `reset-${objectTypeAction}`,
          icon: BiReset,
          labelTranslationKey: `Editor.tools.${objectTypeEdition}-edition.actions.reset-${objectTypeAction}`,
          isDisabled({ state: { entity, initialEntity } }) {
            return isEqual(entity, initialEntity);
          },
          onClick({ setState, state: { initialEntity } }) {
            setState({
              entity: cloneDeep(initialEntity),
            });
          },
        },
      ],
      [
        {
          id: `new-${objectTypeAction}`,
          icon: GoPlusCircle,
          labelTranslationKey: `Editor.tools.${objectTypeEdition}-edition.actions.new-${objectTypeAction}`,
          onClick({ setState }) {
            setState(getInitialState());
          },
        },
      ],
      [
        {
          id: 'delete-entity',
          icon: GoTrash,
          labelTranslationKey: `Editor.tools.${objectTypeEdition}-edition.actions.delete-${objectTypeAction}`,
          // Show button only if we are editing
          isDisabled({ state }) {
            return state.initialEntity.properties.id === NEW_ENTITY_ID;
          },
          onClick({ infraID, openModal, closeModal, forceRender, state, setState, dispatch, t }) {
            openModal(
              <ConfirmModal
                title={t(
                  `Editor.tools.${objectTypeEdition}-edition.actions.delete-${objectTypeAction}`
                )}
                onConfirm={async () => {
                  await dispatch<ReturnType<typeof save>>(
                    // We have to put state.initialEntity in array because delete initially works with selection which can get multiple elements
                    save(infraID, { delete: [state.initialEntity] })
                  );
                  setState(getInitialState());
                  closeModal();
                  forceRender();
                }}
              >
                <p>
                  {t(
                    `Editor.tools.${objectTypeEdition}-edition.actions.confirm-delete-${objectTypeAction}`
                  ).toString()}
                </p>
              </ConfirmModal>
            );
          },
        },
      ],
    ],

    getCursor({ state: { hoveredItem, interactionState } }) {
      if (isOnModeMove(interactionState.type)) return 'grabbing';
      if (hoveredItem) return 'pointer';
      return 'default';
    },
    onClickMap(e, { setState, state: { entity, interactionState } }) {
      const feature = (e.features || [])[0];

      if (isOnModeMove(interactionState.type)) {
        setState({ interactionState: { type: 'idle' } });
      } else if (feature) {
        if (feature.properties?.itemType === 'TrackRangeExtremity') {
          const hoveredExtremity = feature as unknown as TrackRangeExtremityFeature;
          setState({
            hoveredItem: null,
            interactionState: {
              type: 'moveRangeExtremity',
              rangeIndex: hoveredExtremity.properties.rangeIndex,
              extremity: hoveredExtremity.properties.extremity,
            },
          });
        } else if (feature.properties?.itemType === 'PSLSign') {
          const {
            properties: { signType, signIndex },
          } = feature as unknown as PslSignFeature;
          selectPslSign(
            { signType, signIndex },
            setState as (
              stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>
            ) => void
          );
        } else if (feature.properties?.itemType === 'TrackRange') {
          const hoveredRange = feature as unknown as TrackRangeFeature;
          const newEntity = cloneDeep(entity);
          newEntity.properties.track_ranges?.splice(hoveredRange.properties.rangeIndex, 1);
          setState({ entity: newEntity, hoveredItem: null });
        } else if (feature.sourceLayer === 'track_sections') {
          const clickedEntity = feature as unknown as TrackSectionEntity;
          if (
            (entity.properties.track_ranges || []).find(
              (range) => range.track === clickedEntity.properties.id
            )
          )
            return;

          const newEntity = cloneDeep(entity);
          newEntity.properties.track_ranges = newEntity.properties.track_ranges || [];
          newEntity.properties.track_ranges.push({
            track: clickedEntity.properties.id,
            begin: 0,
            end: clickedEntity.properties.length,
            applicable_directions: 'BOTH',
          });
          setState({
            entity: newEntity,
          });
        }
      }
    },
    onKeyDown(e, { setState, state: { interactionState } }) {
      if (e.code === 'Escape' && interactionState.type === 'moveRangeExtremity')
        setState({ interactionState: { type: 'idle' } });
    },
    onHover(e, { setState, state: { hoveredItem, trackSectionsCache, interactionState } }) {
      if (interactionState.type === 'moveRangeExtremity') return;

      const feature = (e.features || [])[0];
      if (!feature) {
        if (hoveredItem) setState({ hoveredItem: null });
        return;
      }

      // Handle hovering custom elements:
      if (feature.properties?.itemType === 'TrackRangeExtremity') {
        const hoveredExtremity = feature as unknown as TrackRangeExtremityFeature;
        const trackState = trackSectionsCache[hoveredExtremity.properties.track];
        if (trackState?.type !== 'success') return;

        const newHoveredItem: HoveredExtremityState = {
          itemType: 'TrackRangeExtremity',
          extremity: hoveredExtremity.properties.extremity,
          position: hoveredExtremity.geometry.coordinates,
          track: trackState.track,
        };
        if (!isEqual(newHoveredItem, hoveredItem))
          setState({
            hoveredItem: newHoveredItem,
          });
      } else if (feature.properties?.itemType === 'TrackRange') {
        const hoveredRange = feature as unknown as TrackRangeFeature;
        const trackState = trackSectionsCache[hoveredRange.properties.track];
        if (trackState?.type !== 'success') return;

        const newHoveredItem: HoveredRangeState = {
          itemType: 'TrackRange',
          position: e.lngLat.toArray(),
          track: trackState.track,
        };
        if (!isEqual(newHoveredItem, hoveredItem))
          setState({
            hoveredItem: newHoveredItem,
          });
      } else if (feature.properties?.itemType === 'PSLSign') {
        const hoveredExtremity = feature as unknown as TrackRangeExtremityFeature;
        const trackState = trackSectionsCache[hoveredExtremity.properties.track];
        if (trackState?.type !== 'success') return;

        const newHoveredItem: HoveredSignState = {
          itemType: 'PSLSign',
          position: hoveredExtremity.geometry.coordinates,
          track: trackState.track,
          signIndex: feature.properties?.speedSectionSignIndex as number,
          signType: feature.properties?.speedSectionSignType as string,
        };
        if (!isEqual(newHoveredItem, hoveredItem))
          setState({
            hoveredItem: newHoveredItem,
          });
      }

      // Handle hovering EditorEntity elements:
      else if (feature.sourceLayer && LAYERS_SET.has(feature.sourceLayer)) {
        const newHoveredItem = {
          id: feature.properties?.id as string,
          type: LAYER_TO_EDITOAST_DICT[feature.sourceLayer as LayerType],
          renderedEntity: feature,
        };
        if (!isEqual(newHoveredItem, hoveredItem))
          setState({
            hoveredItem: newHoveredItem,
          });
      }

      // Handle other cases:
      else if (hoveredItem) {
        setState({ hoveredItem: null });
      }
    },
    onMove(e, { setState, state: { entity, interactionState, hoveredItem, trackSectionsCache } }) {
      if (interactionState.type === 'moveRangeExtremity') {
        const range = (entity.properties?.track_ranges || [])[interactionState.rangeIndex];
        if (!range) return;

        const trackState = trackSectionsCache[range.track];
        if (trackState?.type !== 'success') return;

        const { track } = trackState;
        const nearestPoint = getNearestPoint([track], e.lngLat.toArray());

        const newEntity = cloneDeep(entity);
        const newRange = (newEntity.properties?.track_ranges || [])[interactionState.rangeIndex];

        const distanceAlongTrack = approximateDistanceWithEditoastData(
          track,
          nearestPoint.geometry
        );
        newRange[interactionState.extremity === 'BEGIN' ? 'begin' : 'end'] = distanceAlongTrack;
        setState({
          entity: newEntity,
        });
      } else if (interactionState.type === 'moveSign') {
        if (entity.objType === 'SpeedSection' && entity.properties.extensions?.psl_sncf) {
          const newPosition = getPslSignNewPosition(e, trackSectionsCache);
          if (newPosition) {
            const signInfo = getSignInformationFromInteractionState(interactionState);
            const updatedEntity = getMovedPslEntity(
              entity as SpeedSectionPslEntity,
              signInfo,
              newPosition
            ) as T;
            setState({ entity: updatedEntity });
          }
        }
      } else if (hoveredItem && !e.features?.length) {
        setState({ hoveredItem: null });
      }
    },

    messagesComponent,
    layersComponent,
    leftPanelComponent,
    getInteractiveLayers() {
      return ['editor/geo/track-main'];
    },
    getEventsLayers,
  };
}

export default getRangeEditionTool;
