import React, { ComponentType } from 'react';
import { Map } from 'maplibre-gl';
import { cloneDeep, isEqual } from 'lodash';
import { BiReset } from 'react-icons/bi';
import { BsTrash } from 'react-icons/bs';
import { IconType } from 'react-icons';
import { IoMdAddCircleOutline } from 'react-icons/io';

import { save } from 'reducers/editor';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';
import {
  CatenaryEntity,
  SpeedSectionEntity,
  SpeedSectionPslEntity,
  TrackSectionEntity,
} from 'types/editor';
import { getNearestPoint } from 'utils/mapHelper';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import { PartialOrReducer, Tool } from '../editorContextTypes';
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
} from './utils';

type EditorRange = SpeedSectionEntity | CatenaryEntity;
interface RangeEditionToolParams<T extends EditorRange> {
  id: T['objType'];
  icon: IconType;
  getNewEntity: () => T;
  messagesComponent: ComponentType;
  layersComponent: ComponentType<{ map: Map }>;
  leftPanelComponent: ComponentType;
}

function getRangeEditionTool<T extends EditorRange>({
  id,
  icon,
  getNewEntity,
  messagesComponent,
  layersComponent,
  leftPanelComponent,
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
        : ['catenaries']
    ),
    getInitialState,

    actions: [
      [
        {
          id: `new-${objectTypeAction}`,
          icon: IoMdAddCircleOutline,
          labelTranslationKey: `Editor.tools.${objectTypeEdition}-edition.actions.new-${objectTypeAction}`,
          onClick({ setState }) {
            setState(getInitialState());
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
          id: 'delete-entity',
          icon: BsTrash,
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
        if (feature.properties?.speedSectionItemType === 'TrackRangeExtremity') {
          const hoveredExtremity = feature as unknown as TrackRangeExtremityFeature;
          setState({
            hoveredItem: null,
            interactionState: {
              type: 'moveRangeExtremity',
              rangeIndex: hoveredExtremity.properties.speedSectionRangeIndex,
              extremity: hoveredExtremity.properties.extremity,
            },
          });
        } else if (feature.properties?.speedSectionItemType === 'PSLSign') {
          const {
            properties: { speedSectionSignType, speedSectionSignIndex },
          } = feature as unknown as PslSignFeature;
          selectPslSign(
            { signType: speedSectionSignType, signIndex: speedSectionSignIndex },
            setState as (
              stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>
            ) => void
          );
        } else if (feature.properties?.speedSectionItemType === 'TrackRange') {
          const hoveredRange = feature as unknown as TrackRangeFeature;
          const newEntity = cloneDeep(entity);
          newEntity.properties.track_ranges?.splice(
            hoveredRange.properties.speedSectionRangeIndex,
            1
          );
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
      if (feature.properties?.speedSectionItemType === 'TrackRangeExtremity') {
        const hoveredExtremity = feature as unknown as TrackRangeExtremityFeature;
        const trackState = trackSectionsCache[hoveredExtremity.properties.track];
        if (trackState?.type !== 'success') return;

        const newHoveredItem: HoveredExtremityState = {
          speedSectionItemType: 'TrackRangeExtremity',
          extremity: hoveredExtremity.properties.extremity,
          position: hoveredExtremity.geometry.coordinates,
          track: trackState.track,
        };
        if (!isEqual(newHoveredItem, hoveredItem))
          setState({
            hoveredItem: newHoveredItem,
          });
      } else if (feature.properties?.speedSectionItemType === 'TrackRange') {
        const hoveredRange = feature as unknown as TrackRangeFeature;
        const trackState = trackSectionsCache[hoveredRange.properties.track];
        if (trackState?.type !== 'success') return;

        const newHoveredItem: HoveredRangeState = {
          speedSectionItemType: 'TrackRange',
          position: e.lngLat.toArray(),
          track: trackState.track,
        };
        if (!isEqual(newHoveredItem, hoveredItem))
          setState({
            hoveredItem: newHoveredItem,
          });
      } else if (feature.properties?.speedSectionItemType === 'PSLSign') {
        const hoveredExtremity = feature as unknown as TrackRangeExtremityFeature;
        const trackState = trackSectionsCache[hoveredExtremity.properties.track];
        if (trackState?.type !== 'success') return;

        const newHoveredItem: HoveredSignState = {
          speedSectionItemType: 'PSLSign',
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
  };
}

export default getRangeEditionTool;
