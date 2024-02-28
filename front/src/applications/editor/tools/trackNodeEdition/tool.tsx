import React from 'react';
import { TbSwitch2 } from 'react-icons/tb';
import { AiFillSave } from 'react-icons/ai';
import { GoPlusCircle, GoTrash } from 'react-icons/go';

import { save } from 'reducers/editor';
import { TrackNodeEntity, TrackNodeType } from 'types';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';

import { filter, groupBy } from 'lodash';
import { NEW_ENTITY_ID } from '../../data/utils';
import { Tool } from '../editorContextTypes';
import { DEFAULT_COMMON_TOOL_STATE } from '../commonToolState';
import { TrackNodeEditionLayers, TrackNodeEditionLeftPanel, TrackNodeMessages } from './components';
import { TrackNodeEditionState } from './types';
import { getNewTrackNode } from './utils';

function getInitialState({
  trackNodeTypes,
}: {
  trackNodeTypes: TrackNodeType[] | undefined;
}): TrackNodeEditionState {
  if (!trackNodeTypes?.length) throw new Error('There is no track node type yet.');

  const entity = getNewTrackNode(trackNodeTypes[0]);

  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    entity,
    initialEntity: entity,
    portEditionState: { type: 'idle' },
  };
}

const TrackNodeEditionTool: Tool<TrackNodeEditionState> = {
  id: 'track-node-edition',
  icon: TbSwitch2,
  labelTranslationKey: 'Editor.tools.track-node-edition.label',
  requiredLayers: new Set(['track_nodes', 'track_sections']),
  isDisabled({ editorState }) {
    return (
      !editorState.editorLayers.has('track_nodes') || !editorState.editorLayers.has('track_sections')
    );
  },
  getInitialState,
  actions: [
    [
      {
        id: 'save-track-node',
        icon: AiFillSave,
        labelTranslationKey: 'Editor.tools.track-node-edition.actions.save-track-node',
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
        id: 'new-track-node',
        icon: GoPlusCircle,
        labelTranslationKey: 'Editor.tools.track-node-edition.actions.new-track-node',
        onClick({ setState, trackNodeTypes }) {
          if (!trackNodeTypes?.length) throw new Error('There is no track node type yet.');

          const entity = getNewTrackNode(trackNodeTypes[0]);

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
        id: 'delete-track-node',
        icon: GoTrash,
        labelTranslationKey: `Editor.tools.track-node-edition.actions.delete-track-node`,
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
          trackNodeTypes,
          dispatch,
          t,
        }) {
          openModal(
            <ConfirmModal
              title={t(`Editor.tools.track-node-edition.actions.delete-trak-node`)}
              onConfirm={async () => {
                await dispatch<ReturnType<typeof save>>(
                  // We have to put state.initialEntity in array because delete initially works with selection which can get multiple elements
                  // The cast is required because of the Partial<TrackNodeEntity> returned by getNewTrackNode which doesnt fit with EditorEntity
                  save(infraID, { delete: [state.initialEntity as TrackNodeEntity] })
                );
                setState(getInitialState({ trackNodeTypes }));
                closeModal();
                forceRender();
              }}
            >
              <p>{t('Editor.tools.tack-node-edition.actions.confirm-delete-track-node').toString()}</p>
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

  messagesComponent: TrackNodeMessages,
  layersComponent: TrackNodeEditionLayers,
  leftPanelComponent: TrackNodeEditionLeftPanel,
  getInteractiveLayers() {
    return ['editor/geo/track-main'];
  },
};

export default TrackNodeEditionTool;
