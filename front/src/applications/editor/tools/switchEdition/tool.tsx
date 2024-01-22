import React from 'react';
import { TbSwitch2 } from 'react-icons/tb';
import { AiFillSave } from 'react-icons/ai';
import { GoPlusCircle, GoTrash } from 'react-icons/go';

import { save } from 'reducers/editor';
import { SwitchEntity, SwitchType } from 'types';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';

import { filter, groupBy } from 'lodash';
import { NEW_ENTITY_ID } from '../../data/utils';
import { Tool } from '../editorContextTypes';
import { DEFAULT_COMMON_TOOL_STATE } from '../commonToolState';
import { SwitchEditionLayers, SwitchEditionLeftPanel, SwitchMessages } from './components';
import { SwitchEditionState } from './types';
import { getNewSwitch } from './utils';

function getInitialState({
  switchTypes,
}: {
  switchTypes: SwitchType[] | undefined;
}): SwitchEditionState {
  if (!switchTypes?.length) throw new Error('There is no switch type yet.');

  const entity = getNewSwitch(switchTypes[0]);

  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    entity,
    initialEntity: entity,
    portEditionState: { type: 'idle' },
  };
}

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
  getInitialState,
  actions: [
    [
      {
        id: 'save-switch',
        icon: AiFillSave,
        labelTranslationKey: 'Editor.tools.switch-edition.actions.save-switch',
        isDisabled({ isLoading, state }) {
          const portWithTracks = filter(state.entity?.properties?.ports ?? {}, (p) => !!p?.track);
          const portsKeys = Object.keys(state.entity?.properties?.ports ?? {});
          const detectedDuplicates = filter(
            groupBy(portWithTracks, 'track'),
            (v, _) => v.length > 1
          );
          return (
            state.portEditionState.type !== 'idle' ||
            portWithTracks.length !== portsKeys.length ||
            !!detectedDuplicates.length ||
            isLoading ||
            false
          );
        },
        async onClick({ setIsFormSubmited }) {
          if (setIsFormSubmited) {
            setIsFormSubmited(true);
          }
        },
      },
    ],
    [
      {
        id: 'new-switch',
        icon: GoPlusCircle,
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
    [
      {
        id: 'delete-switch',
        icon: GoTrash,
        labelTranslationKey: `Editor.tools.switch-edition.actions.delete-switch`,
        // Show button only if we are editing
        isDisabled({ state }) {
          return state.initialEntity.properties?.id === NEW_ENTITY_ID;
        },
        onClick({
          infraID,
          openModal,
          closeModal,
          forceRender,
          state,
          setState,
          switchTypes,
          dispatch,
          t,
        }) {
          openModal(
            <ConfirmModal
              title={t(`Editor.tools.switch-edition.actions.delete-switch`)}
              onConfirm={async () => {
                await dispatch<ReturnType<typeof save>>(
                  // We have to put state.initialEntity in array because delete initially works with selection which can get multiple elements
                  // The cast is required because of the Partial<SwitchEntity> returned by getNewSwitch which doesnt fit with EditorEntity
                  save(infraID, { delete: [state.initialEntity as SwitchEntity] })
                );
                setState(getInitialState({ switchTypes }));
                closeModal();
                forceRender();
              }}
            >
              <p>{t('Editor.tools.switch-edition.actions.confirm-delete-switch').toString()}</p>
            </ConfirmModal>
          );
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
