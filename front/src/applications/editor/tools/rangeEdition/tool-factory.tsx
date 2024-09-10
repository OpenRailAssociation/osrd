import { type ComponentType } from 'react';

import { PlusCircle, Trash } from '@osrd-project/ui-icons';
import { cloneDeep, isEqual } from 'lodash';
import type { Map } from 'maplibre-gl';
import type { IconType } from 'react-icons';
import { AiFillSave } from 'react-icons/ai';
import { BiReset } from 'react-icons/bi';

import { LAYER_TO_EDITOAST_DICT, LAYERS_SET, type Layer } from 'applications/editor/consts';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import { DEFAULT_COMMON_TOOL_STATE } from 'applications/editor/tools/consts';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import { approximatePointDistanceForEditoast } from 'applications/editor/tools/utils';
import type { PartialOrReducer, ReadOnlyEditorContextType, Tool } from 'applications/editor/types';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';
import { save } from 'reducers/editor/thunkActions';
import { getNearestPoint } from 'utils/mapHelper';

import type {
  HoveredExtremityState,
  HoveredSignState,
  HoveredRangeState,
  PslSignFeature,
  RangeEditionState,
  TrackRangeExtremityFeature,
  TrackRangeFeature,
  SpeedSectionPslEntity,
  SpeedSectionEntity,
  ElectrificationEntity,
  InteractionState,
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
import type { OptionsStateType } from '../routeEdition/types';

export type EditorRange = SpeedSectionEntity | ElectrificationEntity;
type RangeEditionToolParams<T extends EditorRange> = {
  id: T['objType'];
  icon: IconType;
  getNewEntity: () => T;
  messagesComponent: ComponentType;
  layersComponent: ComponentType<{ map: Map }>;
  leftPanelComponent: ComponentType;
  canSave?: (state: RangeEditionState<T>) => boolean;
  getEventsLayers?: (context: ReadOnlyEditorContextType<RangeEditionState<T>>) => string[];
  requiredLayers: Set<Layer>;
  incompatibleLayers?: Layer[];
};

function getRangeEditionTool<T extends EditorRange>({
  id,
  icon,
  getNewEntity,
  messagesComponent,
  layersComponent,
  leftPanelComponent,
  requiredLayers,
  incompatibleLayers,
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
      interactionState: { type: 'idle' } as InteractionState,
      trackSectionsCache: {},
      optionsState: { type: 'idle' } as OptionsStateType,
      selectedSwitches: {},
      highlightedRoutes: [],
      routeElements: {},
    };
  }

  const objectTypeEdition = getObjTypeEdition(layersEntity.objType);
  const objectTypeAction = getObjTypeAction(layersEntity.objType);

  return {
    id,
    icon,
    labelTranslationKey: `Editor.tools.${objectTypeEdition}-edition.label`,
    requiredLayers,
    incompatibleLayers,
    getInitialState,

    actions: [
      [
        {
          id: `save-${objectTypeAction}`,
          icon: AiFillSave,
          labelTranslationKey: `Editor.tools.${objectTypeEdition}-edition.actions.save-${objectTypeAction}`,
          isDisabled({ isLoading, isInfraLocked, state }) {
            if (isLoading || isInfraLocked) return true;
            if (canSave) return !canSave(state);
            return false;
          },
          async onClick({ state, setState, dispatch, infraID }) {
            const { initialEntity, entity } = state;
            if (!isEqual(entity, initialEntity)) {
              const res = await dispatch(
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
          icon: PlusCircle,
          labelTranslationKey: `Editor.tools.${objectTypeEdition}-edition.actions.new-${objectTypeAction}`,
          onClick({ setState }) {
            setState(getInitialState());
          },
        },
      ],
      [
        {
          id: 'delete-entity',
          icon: Trash,
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
                  await dispatch(
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
    onClickMap(e, { setState, state: { entity, interactionState, selectedSwitches } }) {
      const feature = (e.features || [])[0];

      if (interactionState.type === 'selectSwitch') {
        if (feature && feature.sourceLayer === 'switches') {
          if (Object.keys(selectedSwitches).includes(feature.properties.id)) {
            setState({
              selectedSwitches: Object.fromEntries(
                Object.entries(selectedSwitches).filter(([key]) => key !== feature.properties.id)
              ),
            });
          } else
            setState({
              selectedSwitches: {
                ...selectedSwitches,
                [feature.properties.id]: {
                  position: null,
                  type: feature.properties.switch_type,
                },
              },
            });
        }
      } else if (isOnModeMove(interactionState.type)) {
        if (interactionState.type === 'moveRangeExtremity' && entity.properties.track_ranges) {
          // after resizing a track range, check if the user dragged an extremity beyond the other one
          // if he did, switch the values of each extremities
          const updatedTrackIndex = interactionState.rangeIndex;
          const updatedTrack = entity.properties.track_ranges[updatedTrackIndex];

          if (updatedTrack.begin > updatedTrack.end) {
            [updatedTrack.begin, updatedTrack.end] = [updatedTrack.end, updatedTrack.begin];

            const newEntity = cloneDeep(entity);
            newEntity.properties.track_ranges?.splice(updatedTrackIndex, 1, updatedTrack);
            setState({ entity: newEntity, interactionState: { type: 'idle' } });
          }
          setState({ interactionState: { type: 'idle' } });
        } else {
          setState({ interactionState: { type: 'idle' } });
        }
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
    onHover(
      e,
      { setState, state: { hoveredItem, trackSectionsCache, interactionState, hovered } }
    ) {
      if (interactionState.type === 'moveRangeExtremity') return;

      const feature = (e.features || [])[0];
      if (!feature) {
        if (hoveredItem) setState({ hoveredItem: null });
        if (hovered) setState({ hovered: null });
        return;
      }
      // Handle hovering custom elements:
      if (interactionState.type === 'selectSwitch') {
        if (feature.sourceLayer && LAYERS_SET.has(feature.sourceLayer)) {
          const newHoveredItem = {
            id: feature.properties.id,
            type: LAYER_TO_EDITOAST_DICT[feature.sourceLayer as Layer],
            renderedEntity: feature,
          };
          if (!isEqual(newHoveredItem, hoveredItem)) {
            if (feature.sourceLayer === 'switches') {
              setState({
                hovered: {
                  id: feature.properties.id,
                  type: LAYER_TO_EDITOAST_DICT[feature.sourceLayer as Layer],
                  renderedEntity: feature,
                },
                hoveredItem: null,
              });
            } else {
              setState({
                hovered: null,
              });
            }
          }
        }
      } else if (feature.properties?.itemType === 'TrackRangeExtremity') {
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
          signIndex: feature.properties?.speedSectionSignIndex,
          signType: feature.properties?.speedSectionSignType,
        };
        if (!isEqual(newHoveredItem, hoveredItem))
          setState({
            hoveredItem: newHoveredItem,
          });
      }
      // Handle hovering EditorEntity elements:
      else if (feature.sourceLayer && LAYERS_SET.has(feature.sourceLayer)) {
        const newHoveredItem = {
          id: feature.properties.id,
          type: LAYER_TO_EDITOAST_DICT[feature.sourceLayer as Layer],
          renderedEntity: feature,
        };
        if (!isEqual(newHoveredItem, hoveredItem)) {
          setState({
            hoveredItem: newHoveredItem,
          });
        }
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

        const distanceAlongTrack = approximatePointDistanceForEditoast(
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
      return ['editor/geo/switch-main', 'editor/geo/track-main'];
    },
    getEventsLayers,
  };
}

export default getRangeEditionTool;
