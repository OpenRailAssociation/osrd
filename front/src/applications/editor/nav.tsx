import React from 'react';
import { Dispatch } from 'redux';
import { MapRef } from 'react-map-gl/maplibre';
import { NavigateFunction } from 'react-router-dom';
import { IconType } from 'react-icons';
import { GiRailway } from 'react-icons/gi';
import { FaRegCompass } from 'react-icons/fa';
import { GoSearch, GoZoomIn, GoZoomOut } from 'react-icons/go';
import { BsExclamationOctagon, BsSliders2 } from 'react-icons/bs';
import { isNil } from 'lodash';

import type { Shortcut } from 'utils/hooks/useKeyboardShortcuts';

import LayersModal from 'applications/editor/components/LayersModal';
import { EDITOAST_TO_LAYER_DICT } from 'applications/editor/tools/types';
import { SelectionState } from 'applications/editor/tools/selection/types';
import type { EditorState, EditoastType } from 'applications/editor/tools/types';
import type { EditorContextType, Tool } from 'applications/editor/tools/editorContextTypes';

import InfraSelectorModal from 'common/InfraSelector/InfraSelectorModal';
import type { ModalContextType } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

import type { Viewport } from 'reducers/map';
import { editorSliceActions } from 'reducers/editor';

const ZOOM_DEFAULT = 5;
const ZOOM_DELTA = 1.5;

export interface NavButton {
  id: string;
  icon: IconType;
  labelTranslationKey: string;
  shortcut?: Omit<Shortcut, 'handler'>;

  // Tool appearance:
  isActive?: (editorState: EditorState) => boolean;
  isHidden?: (editorState: EditorState) => boolean;
  isDisabled?: (editorState: EditorState) => boolean;
  isBlink?: (editorState: EditorState, infraId?: string | number) => boolean;

  // On click button:
  onClick?: <S = unknown>(
    context: {
      navigate: NavigateFunction;
      dispatch: Dispatch;
      viewport: Viewport;
      editorState: EditorState;
      setViewport: (newViewport: Partial<Viewport>) => void;
      openModal: ModalContextType['openModal'];
      closeModal: ModalContextType['closeModal'];
      setIsSearchToolOpened: React.Dispatch<React.SetStateAction<boolean>>;
      mapRef: MapRef;
    },
    toolContext: {
      activeTool: Tool<S>;
      toolState: S;
      setToolState: (newState: S) => void;
      switchTool: EditorContextType['switchTool'];
    }
  ) => void;
}

const NavButtons: NavButton[][] = [
  [
    {
      id: 'zoom-in',
      icon: GoZoomIn,
      labelTranslationKey: 'common.zoom-in',
      onClick({ setViewport, viewport }) {
        setViewport({
          ...viewport,
          zoom: (viewport.zoom || ZOOM_DEFAULT) + ZOOM_DELTA,
        });
      },
    },
    {
      id: 'zoom-out',
      icon: GoZoomOut,
      labelTranslationKey: 'common.zoom-out',
      onClick({ setViewport, viewport }) {
        setViewport({
          ...viewport,
          zoom: (viewport.zoom || ZOOM_DEFAULT) - ZOOM_DELTA,
        });
      },
    },
    {
      id: 'reset-viewport',
      icon: FaRegCompass,
      labelTranslationKey: 'common.reset-north',
      onClick({ setViewport, viewport }) {
        setViewport({
          ...viewport,
          bearing: 0,
          pitch: 0,
        });
      },
    },
    {
      id: 'search',
      icon: GoSearch,
      labelTranslationKey: 'common.search',
      onClick({ setIsSearchToolOpened }) {
        setIsSearchToolOpened((state) => !state);
      },
    },
  ],
  [
    {
      id: 'layers',
      icon: BsSliders2,
      labelTranslationKey: 'Editor.nav.toggle-layers',
      shortcut: { code: 'KeyL', optionalKeys: { ctrlKey: true, shiftKey: true } },
      onClick({ openModal, editorState }, { activeTool, toolState, setToolState }) {
        openModal(
          <LayersModal
            initialLayers={editorState.editorLayers}
            frozenLayers={activeTool.requiredLayers}
            selection={
              activeTool.id === 'select-items'
                ? (toolState as unknown as SelectionState).selection
                : undefined
            }
            onChange={({ newLayers }) => {
              if (activeTool.id === 'select-items') {
                const currentState = toolState as unknown as SelectionState;
                (setToolState as unknown as (newState: SelectionState) => void)({
                  ...currentState,
                  selection: currentState.selection.filter((entity) =>
                    EDITOAST_TO_LAYER_DICT[entity.objType as EditoastType].every((layer) =>
                      newLayers.has(layer)
                    )
                  ),
                } as SelectionState);
              }
            }}
          />,
          'lg'
        );
      },
    },
    {
      id: 'infras',
      icon: GiRailway,
      labelTranslationKey: 'Editor.nav.select-infra',
      isBlink: (_editorState, infraId) => isNil(infraId),
      async onClick({ navigate, openModal }) {
        openModal(<InfraSelectorModal onInfraChange={(id) => navigate(`/editor/${id}`)} />, 'lg');
      },
    },
    {
      id: 'infra-errors',
      icon: BsExclamationOctagon,
      labelTranslationKey: 'Editor.nav.infra-errors-map',
      shortcut: { code: 'KeyE', optionalKeys: { ctrlKey: true, shiftKey: true } },
      isActive: (state) => state.editorLayers.has('errors'),
      onClick({ dispatch, editorState }) {
        const newSet = new Set(editorState.editorLayers);
        if (newSet.has('errors')) newSet.delete('errors');
        else newSet.add('errors');
        dispatch(editorSliceActions.selectLayers(newSet));
      },
    },
  ],
];

export default NavButtons;
