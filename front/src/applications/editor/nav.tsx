import React from 'react';
import { Dispatch } from 'redux';
import { IconType } from 'react-icons/lib/esm/iconBase';
import { BiTargetLock } from 'react-icons/bi';
import { BsFillExclamationOctagonFill } from 'react-icons/bs';
import { FiLayers, FiZoomIn, FiZoomOut } from 'react-icons/fi';
import { FaCompass } from 'react-icons/fa';
import { GiRailway } from 'react-icons/gi';
import turfCenter from '@turf/center';
import { isNil } from 'lodash';
import { NavigateFunction } from 'react-router-dom';

import { Viewport } from 'reducers/map';
import { ModalContextType } from '../../common/BootstrapSNCF/ModalSNCF/ModalProvider';
import {
  EditorState,
  EDITOAST_TO_LAYER_DICT,
  Tool,
  EditoastType,
  EditorContextType,
} from './tools/types';
import InfraSelectorModal from '../../common/InfraSelector/InfraSelectorModal';
import InfraErrorsModal from './components/InfraErrors/InfraErrorsModal';
import LayersModal from './components/LayersModal';
import { SelectionState } from './tools/selection/types';
import { RouteEntity } from '../../types';
import RouteEditionTool from './tools/routeEdition/tool';
import { getEditRouteState } from './tools/routeEdition/utils';
import { getEntity } from './data/api';
import { InfraError } from './components/InfraErrors/types';
import SelectionTool from './tools/selection/tool';

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
        openModal(
          <LayersModal
            initialLayers={editorState.editorLayers}
            frozenLayers={activeTool.requiredLayers}
            selection={
              activeTool.id === 'select-items'
                ? (toolState as unknown as SelectionState).selection
                : undefined
            }
            onSubmit={({ newLayers }) => {
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
      icon: BsFillExclamationOctagonFill,
      labelTranslationKey: 'Editor.nav.infra-errors',
      async onClick({ openModal, closeModal, setViewport }, { switchTool }) {
        openModal(
          <InfraErrorsModal
            onErrorClick={async (infraID: number, item: InfraError) => {
              const entity = await getEntity(
                infraID,
                item.information.obj_id,
                item.information.obj_type
              );
              // select the item in the editor scope
              if (entity.objType === 'Route') {
                switchTool(RouteEditionTool, getEditRouteState(entity as RouteEntity));
              } else {
                switchTool(SelectionTool, { selection: [entity] });

                // center the map on the object
                if (item.geographic) {
                  const geoCenter = turfCenter(item.geographic);
                  setViewport({
                    longitude: geoCenter.geometry.coordinates[0],
                    latitude: geoCenter.geometry.coordinates[1],
                    zoom: 20,
                  });
                }
              }
              // closing the modal
              closeModal();
            }}
          />,
          'lg'
        );
      },
    },
  ],
];

export default NavButtons;
