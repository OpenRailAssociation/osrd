import { TbSwitch2 } from 'react-icons/tb';
import { IoMdAddCircleOutline } from 'react-icons/io';

import { SwitchEditionState } from './types';
import { getNewSwitch } from './utils';
import { SwitchEditionLayers, SwitchEditionLeftPanel, SwitchMessages } from './components';
import { Tool } from '../editorContextTypes';
import { DEFAULT_COMMON_TOOL_STATE } from '../commonToolState';

const SwitchEditionTool: Tool<SwitchEditionState> = {
  id: 'switch-edition',
  icon: TbSwitch2,
  labelTranslationKey: 'Editor.tools.switch-edition.label',
  requiredLayers: new Set(['switches', 'track_sections']),
  isDisabled({ editorState }) {
    return (
      !editorState.editorLayers.has('switches') || !editorState.editorLayers.has('track_sections')
    );
  },

  getInitialState({ switchTypes }) {
    if (!switchTypes?.length) throw new Error('There is no switch type yet.');

    const entity = getNewSwitch(switchTypes[0]);

    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      entity,
      initialEntity: entity,
      portEditionState: { type: 'idle' },
    };
  },

  actions: [
    [
      {
        id: 'new-switch',
        icon: IoMdAddCircleOutline,
        labelTranslationKey: 'Editor.tools.switch-edition.actions.new-switch',
        onClick({ setState, switchTypes }) {
          if (!switchTypes?.length) throw new Error('There is no switch type yet.');

          const entity = getNewSwitch(switchTypes[0]);

          setState({
            ...DEFAULT_COMMON_TOOL_STATE,
            entity,
            initialEntity: entity,
            portEditionState: { type: 'idle' },
          });
        },
      },
    ],
  ],

  getCursor({ state }) {
    if (state.portEditionState.type === 'selection' && state.hovered) return 'pointer';
    return 'default';
  },
  onKeyDown(e, { state, setState }) {
    if (state.portEditionState.type === 'selection' && e.key === 'Escape') {
      setState({
        ...state,
        portEditionState: { type: 'idle' },
      });
    }
  },
  onClickEntity(_feature, _e, { state }) {
    if (state.portEditionState.type === 'selection' && state.portEditionState.hoveredPoint) {
      state.portEditionState.onSelect(state.portEditionState.hoveredPoint);
    }
  },

  messagesComponent: SwitchMessages,
  layersComponent: SwitchEditionLayers,
  leftPanelComponent: SwitchEditionLeftPanel,
  getInteractiveLayers() {
    return ['editor/geo/track-main'];
  },
};

export default SwitchEditionTool;
