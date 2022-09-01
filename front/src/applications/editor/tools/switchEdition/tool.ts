import { TbSwitch2 } from 'react-icons/tb';
import { TiDeleteOutline } from 'react-icons/ti';

import { DEFAULT_COMMON_TOOL_STATE, Tool } from '../types';
import { SwitchEditionState } from './types';
import { getNewSwitch } from './utils';
import { SwitchEditionLayers, SwitchEditionLeftPanel } from './components';

const SwitchEditionTool: Tool<SwitchEditionState> = {
  id: 'switch-edition',
  icon: TbSwitch2,
  labelTranslationKey: 'Editor.tools.switch-edition.label',

  getInitialState({ osrdConf }) {
    if (!osrdConf.switchTypes?.length) throw new Error('There is no switch type yet.');

    const entity = getNewSwitch(osrdConf.switchTypes[0]);

    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      portState: { type: 'idle' },
      entity,
      initialEntity: entity,
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
          return !state.initialEntity.id;
        },
      },
    ],
  ],

  layersComponent: SwitchEditionLayers,
  leftPanelComponent: SwitchEditionLeftPanel,
};

export default SwitchEditionTool;
