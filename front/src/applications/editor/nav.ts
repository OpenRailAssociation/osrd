import { Dispatch } from 'redux';
import { IconType } from 'react-icons/lib/esm/iconBase';
import { BiTargetLock } from 'react-icons/bi';
import { BsMap, BsFillExclamationOctagonFill } from 'react-icons/bs';
import { FiLayers, FiZoomIn, FiZoomOut } from 'react-icons/fi';
import { FaCompass } from 'react-icons/fa';

import { Viewport } from 'reducers/map';
import {
  EditorState,
  ModalRequest,
  EDITOAST_TO_LAYER_DICT,
  Tool,
  EditoastType,
} from './tools/types';
import InfraSelectionModal from './components/InfraSelectionModal';
import InfraErrorsModal from './components/InfraErrors/InfraErrorsModal';
import LayersModal from './components/LayersModal';
import { SelectionState } from './tools/selection/types';

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
  // Tool appearance:
  isActive?: (editorState: EditorState) => boolean;
  isHidden?: (editorState: EditorState) => boolean;
  isDisabled?: (editorState: EditorState) => boolean;
  // On click button:
  onClick?: <S = unknown>(
    context: {
      dispatch: Dispatch;
      viewport: Viewport;
      editorState: EditorState;
      setViewport: (newViewport: Partial<Viewport>) => void;
      openModal: <ArgumentsType, SubmitArgumentsType>(
        request: ModalRequest<ArgumentsType, SubmitArgumentsType>
      ) => void;
    },
    toolContext: {
      activeTool: Tool<S>;
      toolState: S;
      setToolState: (newState: S) => void;
    }
  ) => void;
}

const NavButtons: NavButton[][] = [
  [
    {
      id: 'zoom-in',
      icon: FiZoomIn,
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
      icon: FiZoomOut,
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
      icon: FiLayers,
      labelTranslationKey: 'Editor.nav.toggle-layers',
      onClick({ openModal, editorState }, { activeTool, toolState, setToolState }) {
        openModal({
          component: LayersModal,
          arguments: {
            initialLayers: editorState.editorLayers,
            frozenLayers: activeTool.requiredLayers,
            selection:
              activeTool.id === 'select-items'
                ? (toolState as unknown as SelectionState).selection
                : undefined,
          },
          beforeSubmit({ newLayers }) {
            if (activeTool.id === 'select-items') {
              const currentState = toolState as unknown as SelectionState;
              (setToolState as unknown as (newState: SelectionState) => void)({
                ...currentState,
                selection: currentState.selection.filter((entity) =>
                  newLayers.has(EDITOAST_TO_LAYER_DICT[entity.objType as EditoastType])
                ),
              } as SelectionState);
            }
          },
        });
      },
    },
    {
      id: 'infras',
      icon: BsMap,
      labelTranslationKey: 'Editor.nav.select-infra',
      async onClick({ openModal }) {
        openModal({
          component: InfraSelectionModal,
          arguments: {},
        });
      },
    },
    {
      id: 'infra-errors',
      icon: BsFillExclamationOctagonFill,
      labelTranslationKey: 'Editor.nav.infra-errors',
      async onClick({ openModal }) {
        openModal({
          component: InfraErrorsModal,
          arguments: {},
        });
      },
    },
  ],
];

export default NavButtons;
