import { TbSwitch2 } from 'react-icons/tb';
import { TiDeleteOutline } from 'react-icons/ti';

import { IoMdAddCircleOutline } from 'react-icons/io';
import { DEFAULT_COMMON_TOOL_STATE, Tool } from '../types';
import { SwitchEditionState } from './types';
import { getNewSwitch } from './utils';
import { SwitchEditionLayers, SwitchEditionLeftPanel, SwitchMessages } from './components';
import { NEW_ENTITY_ID } from '../../data/utils';

const SwitchEditionTool: Tool<SwitchEditionState> = {
  id: 'switch-edition',
  icon: TbSwitch2,
  labelTranslationKey: 'Editor.tools.switch-edition.label',
  requiredLayers: new Set(['switches', 'track_sections']),
  isDisabled({ editorState }) {
    return (
      !editorState.editorZone ||
      !editorState.editorLayers.has('switches') ||
      !editorState.editorLayers.has('track_sections')
    );
  },

  getInitialState({ osrdConf }) {
    if (!osrdConf.switchTypes?.length) throw new Error('There is no switch type yet.');

    const entity = getNewSwitch(osrdConf.switchTypes[0]);

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
        id: 'delete-switch',
        icon: TiDeleteOutline,
        labelTranslationKey: 'Editor.tools.switch-edition.actions.delete-switch',
        onClick() {
          // TODO:
          // Delete currently edited switch
        },
        isDisabled({ state }) {
          return (
            !state.initialEntity.properties?.id ||
            state.initialEntity.properties.id === NEW_ENTITY_ID
          );
        },
      },
      {
        id: 'new-switch',
        icon: IoMdAddCircleOutline,
        labelTranslationKey: 'Editor.tools.switch-edition.actions.new-switch',
        onClick({ setState, osrdConf }) {
          if (!osrdConf.switchTypes?.length) throw new Error('There is no switch type yet.');

          const entity = getNewSwitch(osrdConf.switchTypes[0]);

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
  onClickFeature(feature, e, { state }) {
    if (state.portEditionState.type === 'selection') {
      state.portEditionState.onSelect(feature.properties.id, [e.point.x, e.point.y]);
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
