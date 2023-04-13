import { MdSpeed } from 'react-icons/md';
import { IoMdAddCircleOutline } from 'react-icons/io';
import { cloneDeep, groupBy, isEqual } from 'lodash';
import { BiReset } from 'react-icons/bi';

import {
  DEFAULT_COMMON_TOOL_STATE,
  LAYER_TO_EDITOAST_DICT,
  LAYERS_SET,
  LayerType,
  Tool,
} from '../types';
import {
  HoveredExtremityState,
  HoveredRangeState,
  SpeedSectionEditionState,
  TrackRangeExtremityFeature,
  TrackRangeFeature,
} from './types';
import { getEditSpeedSectionState, getNewSpeedSection } from './utils';
import {
  SpeedSectionEditionLayers,
  SpeedSectionEditionLeftPanel,
  SpeedSectionMessages,
} from './components';
import { EditorEntity, TrackSectionEntity } from '../../../../types';

const SpeedSectionEditionTool: Tool<SpeedSectionEditionState> = {
  id: 'speed-section-edition',
  icon: MdSpeed,
  labelTranslationKey: 'Editor.tools.speed-section-edition.label',
  requiredLayers: new Set(['speed_sections']),
  isDisabled({ editorState }) {
    return !editorState.editorLayers.has('speed_sections');
  },

  getInitialState() {
    return getEditSpeedSectionState(getNewSpeedSection());
  },

  actions: [
    [
      {
        id: 'new-speed-section',
        icon: IoMdAddCircleOutline,
        labelTranslationKey: 'Editor.tools.speed-section-edition.actions.new-speed-section',
        onClick({ setState }) {
          const entity = getNewSpeedSection();

          setState({
            ...DEFAULT_COMMON_TOOL_STATE,
            entity,
            initialEntity: entity,
          });
        },
      },
      {
        id: 'reset-speed-section',
        icon: BiReset,
        labelTranslationKey: 'Editor.tools.speed-section-edition.actions.reset-speed-section',
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
    if (interactionState.type !== 'movePoint' && hoveredItem) return 'pointer';
    if (interactionState.type === 'movePoint') return 'grabbing';
    return 'default';
  },
  onClickMap(e, { setState, state: { entity, interactionState } }) {
    const feature = (e.features || [])[0];

    if (interactionState.type === 'movePoint') {
      // TODO
    } else if (feature) {
      if (feature.properties?.speedSectionItemType === 'TrackRangeExtremity') {
        const hoveredExtremity = feature as any as TrackRangeExtremityFeature;
        setState({
          hoveredItem: null,
          interactionState: {
            type: 'movePoint',
            rangeIndex: hoveredExtremity.properties.speedSectionRangeIndex,
            extremity: hoveredExtremity.properties.extremity,
          },
        });
      } else if (feature.properties?.speedSectionItemType === 'TrackRange') {
        const hoveredRange = feature as any as TrackRangeFeature;
        const newEntity = cloneDeep(entity);
        newEntity.properties.track_ranges?.splice(
          hoveredRange.properties.speedSectionRangeIndex,
          1
        );
        setState({ entity: newEntity, hoveredItem: null });
      } else if (feature.sourceLayer === 'track_sections') {
        const clickedEntity = feature as any as TrackSectionEntity;
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
    if (e.code === 'Escape' && interactionState.type === 'movePoint')
      setState({ interactionState: { type: 'idle' } });
  },
  onHover(e, { setState, state: { hoveredItem, trackSectionsCache, interactionState } }) {
    if (interactionState.type === 'movePoint') return;

    const feature = (e.features || [])[0];

    if (!feature) {
      if (hoveredItem) setState({ hoveredItem: null });
      return;
    }

    // Handle hovering custom elements:
    if (feature.properties?.speedSectionItemType === 'TrackRangeExtremity') {
      const hoveredExtremity = feature as any as TrackRangeExtremityFeature;
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
      const hoveredRange = feature as any as TrackRangeFeature;
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
    }

    // Handle hovering EditorEntity elements:
    else if (LAYERS_SET.has(feature.sourceLayer)) {
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
  onMove(_e, { setState, state: { interactionState, hoveredItem } }) {
    if (interactionState.type === 'movePoint') {
      // TODO
    } else if (hoveredItem) {
      setState({ hoveredItem: null });
    }
  },

  messagesComponent: SpeedSectionMessages,
  layersComponent: SpeedSectionEditionLayers,
  leftPanelComponent: SpeedSectionEditionLeftPanel,
  getInteractiveLayers() {
    return ['editor/geo/track-main'];
  },
};

export default SpeedSectionEditionTool;
