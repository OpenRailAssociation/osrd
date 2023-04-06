import { MdSpeed } from 'react-icons/md';
import { IoMdAddCircleOutline } from 'react-icons/io';

import { DEFAULT_COMMON_TOOL_STATE, Tool } from '../types';
import { SpeedSectionEditionState } from './types';
import { getNewSpeedSection } from './utils';
import {
  SpeedSectionEditionLayers,
  SpeedSectionEditionLeftPanel,
  SpeedSectionMessages,
} from './components';

const SpeedSectionEditionTool: Tool<SpeedSectionEditionState> = {
  id: 'speed-section-edition',
  icon: MdSpeed,
  labelTranslationKey: 'Editor.tools.speed-section-edition.label',
  requiredLayers: new Set(['speed_sections']),
  isDisabled({ editorState }) {
    return !editorState.editorLayers.has('speed_sections');
  },

  getInitialState() {
    const entity = getNewSpeedSection();

    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      entity,
      initialEntity: entity,
    };
  },

  actions: [
    [
      {
        id: 'new-switch',
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
    ],
  ],

  getCursor() {
    return 'default';
  },

  messagesComponent: SpeedSectionMessages,
  layersComponent: SpeedSectionEditionLayers,
  leftPanelComponent: SpeedSectionEditionLeftPanel,
  getInteractiveLayers() {
    return ['editor/geo/track-main'];
  },
};

export default SpeedSectionEditionTool;
