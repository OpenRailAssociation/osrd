import { IoMdAddCircleOutline } from 'react-icons/io';
import { cloneDeep, isEqual } from 'lodash';
import { BiReset } from 'react-icons/bi';
import { Map } from 'maplibre-gl';
import { IconType } from 'react-icons';
import { ComponentType } from 'react';

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
} from './utils';
import {
  CatenaryEntity,
  SpeedSectionEntity,
  SpeedSectionPslEntity,
  TrackSectionEntity,
} from '../../../../types';
import { getNearestPoint } from '../../../../utils/mapHelper';
import { approximateDistanceWithEditoastData } from '../utils';
import { PartialOrReducer, Tool } from '../editorContextTypes';
import { DEFAULT_COMMON_TOOL_STATE } from '../commonToolState';

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

  return {
    id,
    icon,
    labelTranslationKey:
      layersEntity.objType === 'SpeedSection'
        ? 'Editor.tools.speed-edition.label'
        : 'Editor.tools.catenary-edition.label',
    requiredLayers: new Set(
      layersEntity.objType === 'SpeedSection'
        ? ['speed_sections', 'psl', 'psl_signs']
        : ['catenaries']
    ),
    getInitialState,

    actions: [
      [
        layersEntity.objType === 'SpeedSection'
          ? {
              id: 'new-speed-section',
              icon: IoMdAddCircleOutline,
              labelTranslationKey: 'Editor.tools.speed-edition.actions.new-speed-section',
              onClick({ setState }) {
                setState(getInitialState());
              },
            }
          : {
              id: 'new-catenary',
              icon: IoMdAddCircleOutline,
              labelTranslationKey: 'Editor.tools.catenary-edition.actions.new-catenary',
              onClick({ setState }) {
                setState(getInitialState());
              },
            },
        layersEntity.objType === 'SpeedSection'
          ? {
              id: 'reset-speed-section',
              icon: BiReset,
              labelTranslationKey: 'Editor.tools.speed-edition.actions.reset-speed-section',
              isDisabled({ state: { entity, initialEntity } }) {
                return isEqual(entity, initialEntity);
              },
              onClick({ setState, state: { initialEntity } }) {
                setState({
                  entity: cloneDeep(initialEntity),
                });
              },
            }
          : {
              id: 'reset-catenary',
              icon: BiReset,
              labelTranslationKey: 'Editor.tools.catenary-edition.actions.reset-catenary',
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
