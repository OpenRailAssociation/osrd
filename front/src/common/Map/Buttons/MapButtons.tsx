import React, { useRef, useState, useContext, useEffect, useCallback } from 'react';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import type { MapRef } from 'react-map-gl/maplibre';
import cx from 'classnames';

// Buttons
import ButtonMapSearch from 'common/Map/Buttons/ButtonMapSearch';
import ButtonMapSettings from 'common/Map/Buttons/ButtonMapSettings';
import ButtonMapKey from 'common/Map/Buttons/ButtonMapKey';
import ButtonResetViewport from 'common/Map/Buttons/ButtonResetViewport';
import ButtonZoomIn from 'common/Map/Buttons/ButtonZoomIn';
import ButtonZoomOut from 'common/Map/Buttons/ButtonZoomOut';

// Viewport
import { updateViewport } from 'reducers/map';

// Map modals
import ButtonMapInfras from 'common/Map/Buttons/ButtonMapInfras';
import MapKey from 'common/Map/MapKey';
import MapSearch from 'common/Map/Search/MapSearch';
import MapSettings from 'common/Map/Settings/MapSettings';

import useOutsideClick from 'utils/hooks/useOutsideClick';

// Editor
import type { PartialOrReducer, Tool } from 'applications/editor/types';
import { EDITOAST_TO_LAYER_DICT, type EditoastType } from 'applications/editor/consts';
import LayersModal from 'applications/editor/components/LayersModal';
import type { SelectionState } from 'applications/editor/tools/selection/types';
import type { CommonToolState } from 'applications/editor/tools/types';
import { useAppDispatch } from 'store';
import type { EditorState } from 'reducers/editor';
import ButtonMapInfraErrors from './ButtonMapInfraErrors';

type MapButtonsProps = {
  map?: MapRef;
  resetPitchBearing: () => void;
  closeFeatureInfoClickPopup?: () => void;
  withInfraButton?: boolean;
  withMapKeyButton?: boolean;
  bearing: number;
  editorProps?: {
    toolState: CommonToolState;
    setToolState: (stateOrReducer: PartialOrReducer<CommonToolState>) => void;
    editorState: EditorState;
    activeTool: Tool<CommonToolState>;
  };
};

const ZOOM_DEFAULT = 5;
const ZOOM_DELTA = 1.5;
const DEFAULT_VIEWPORT = {
  latitude: 47.3,
  longitude: 2.0,
  zoom: 5.0,
  bearing: 0,
  pitch: 0,
};

const MAP_POPOVERS = { SEARCH: 'SEARCH', SETTINGS: 'SETTINGS', KEY: 'KEY' };
export default function MapButtons({
  map,
  resetPitchBearing,
  closeFeatureInfoClickPopup,
  withInfraButton,
  withMapKeyButton,
  bearing,
  editorProps,
}: MapButtonsProps) {
  const dispatch = useAppDispatch();
  const { isOpen, openModal } = useContext(ModalContext);

  const [openedPopover, setOpenedPopover] = useState<string | undefined>(undefined);

  const toggleMapModal = (keyModal: string) => {
    setOpenedPopover(keyModal !== openedPopover ? keyModal : undefined);
  };

  const openMapSettingsModal = useCallback(() => {
    if (editorProps) {
      const { activeTool, setToolState, editorState, toolState } = editorProps;
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
              setToolState({
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
    } else {
      toggleMapModal('SETTINGS');
    }
  }, [editorProps]);

  const mapButtonsRef = useRef<HTMLDivElement | null>(null);

  // Close the pop up of the map
  useEffect(() => {
    if (closeFeatureInfoClickPopup) closeFeatureInfoClickPopup();
  }, [openedPopover, isOpen]);

  // Close the Popover when opening modal
  useEffect(() => {
    setOpenedPopover(undefined);
  }, [isOpen]);

  useOutsideClick(mapButtonsRef, () => setOpenedPopover(undefined));

  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);

  const zoomIn = () => {
    setViewport((prevViewport) => ({
      ...prevViewport,
      zoom: (prevViewport.zoom || ZOOM_DEFAULT) + ZOOM_DELTA,
    }));
    dispatch(
      updateViewport({
        ...viewport,
        zoom: (viewport.zoom || ZOOM_DEFAULT) + ZOOM_DELTA,
      })
    );
  };
  const zoomOut = () => {
    setViewport((prevViewport) => ({
      ...prevViewport,
      zoom: (prevViewport.zoom || ZOOM_DEFAULT) - ZOOM_DELTA,
    }));
    dispatch(
      updateViewport({
        ...viewport,
        zoom: (viewport.zoom || ZOOM_DEFAULT) - ZOOM_DELTA,
      })
    );
  };

  return (
    <div ref={mapButtonsRef}>
      <div
        className={cx('btn-map-container', {
          editor: !!editorProps,
        })}
      >
        <ButtonZoomIn zoomIn={() => zoomIn()} />
        <ButtonZoomOut zoomOut={() => zoomOut()} />
        <ButtonResetViewport updateLocalViewport={resetPitchBearing} bearing={bearing} />
        <ButtonMapSearch toggleMapSearch={() => toggleMapModal('SEARCH')} />
        <ButtonMapSettings toggleMapSettings={openMapSettingsModal} />
        {withInfraButton && <ButtonMapInfras isInEditor={!!editorProps} />}
        {editorProps && <ButtonMapInfraErrors editorState={editorProps.editorState} />}
        {withMapKeyButton && <ButtonMapKey toggleMapKey={() => toggleMapModal('KEY')} />}
      </div>
      {openedPopover === MAP_POPOVERS.SEARCH && (
        <MapSearch map={map} closeMapSearchPopUp={() => setOpenedPopover(undefined)} />
      )}
      {openedPopover === MAP_POPOVERS.SETTINGS && (
        <MapSettings closeMapSettingsPopUp={() => setOpenedPopover(undefined)} />
      )}
      {openedPopover === MAP_POPOVERS.KEY && (
        <MapKey closeMapKeyPopUp={() => setOpenedPopover(undefined)} />
      )}
    </div>
  );
}
