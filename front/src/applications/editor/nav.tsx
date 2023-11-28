import React from 'react';
import { Dispatch } from 'redux';
import { IconType } from 'react-icons';
import { BiTargetLock } from 'react-icons/bi';
import { BsFillExclamationOctagonFill } from 'react-icons/bs';
import { FaCompass } from 'react-icons/fa';
import { GiRailway } from 'react-icons/gi';
import { isNil } from 'lodash';
import { NavigateFunction } from 'react-router-dom';
import { MapRef } from 'react-map-gl/maplibre';

import { Viewport } from 'reducers/map';
import { selectLayers } from 'reducers/editor';
import { Shortcut } from 'utils/hooks/useKeyboardShortcuts';
import { ModalContextType } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import InfraSelectorModal from 'common/InfraSelector/InfraSelectorModal';
import { GoSearch, GoStack, GoZoomIn, GoZoomOut } from 'react-icons/go';
import { EditorState, EDITOAST_TO_LAYER_DICT, EditoastType } from './tools/types';
import LayersModal from './components/LayersModal';
import { SelectionState } from './tools/selection/types';
import { EditorContextType, Tool } from './tools/editorContextTypes';

const ZOOM_DEFAULT = 5;
const ZOOM_DELTA = 1.5;
const DEFAULT_VIEWPORT = {
  latitude: 47.3,
  longitude: 2.0,
  zoom: 5.0,
  bearing: 0,
  pitch: 0,
};

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
      id: 'search',
      icon: GoSearch,
      labelTranslationKey: 'common.search',
      onClick({ setIsSearchToolOpened }) {
        setIsSearchToolOpened((state) => !state);
      },
    },
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
      id: 'recenter',
      icon: BiTargetLock,
      labelTranslationKey: 'Editor.nav.recenter',
      onClick({ setViewport, viewport }) {
        setViewport({
          ...viewport,
          ...DEFAULT_VIEWPORT,
        });
      },
    },
    {
      id: 'reset-viewport',
      icon: FaCompass,
      labelTranslationKey: 'common.reset-north',
      onClick({ setViewport, viewport }) {
        setViewport({
          ...viewport,
          bearing: 0,
          pitch: 0,
        });
      },
    },
  ],
  [
    {
      id: 'layers',
      icon: GoStack,
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
      shortcut: { code: 'KeyI', optionalKeys: { ctrlKey: true, shiftKey: true } },
      isBlink: (_editorState, infraId) => isNil(infraId),
      async onClick({ navigate, openModal }) {
        openModal(<InfraSelectorModal onInfraChange={(id) => navigate(`/editor/${id}`)} />, 'lg');
      },
    },
    {
      id: 'infra-errors',
      icon: BsFillExclamationOctagonFill,
      labelTranslationKey: 'Editor.nav.infra-errors-map',
      shortcut: { code: 'KeyE', optionalKeys: { ctrlKey: true, shiftKey: true } },
      isActive: (state) => state.editorLayers.has('errors'),
      onClick({ dispatch, editorState }) {
        const newSet = new Set(editorState.editorLayers);
        if (newSet.has('errors')) newSet.delete('errors');
        else newSet.add('errors');
        dispatch(selectLayers(newSet));
      },
    },
  ],
];

export default NavButtons;
