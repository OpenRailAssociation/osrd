import { useRef, useState, useContext, useEffect, useCallback } from 'react';

import {
  CompassCardinalV2,
  CompassNeedleV2,
  Info,
  Search,
  Sliders,
  ZoomIn,
  ZoomOut,
} from '@osrd-project/ui-icons';
import cx from 'classnames';
import type { MapRef } from 'react-map-gl/maplibre';

import LayersModal from 'applications/editor/components/LayersModal';
import { EDITOAST_TO_LAYER_DICT, type EditoastType } from 'applications/editor/consts';
import type { SelectionState } from 'applications/editor/tools/selection/types';
import type { CommonToolState } from 'applications/editor/tools/types';
import type { PartialOrReducer, Tool } from 'applications/editor/types';
import StdcmLayersModal from 'applications/stdcm/components/StdcmLayersModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import ButtonMapInfras from 'common/Map/Buttons/ButtonMapInfras';
import MapKey from 'common/Map/MapKey';
import MapSearch from 'common/Map/Search/MapSearch';
import MapSettings from 'common/Map/Settings/MapSettings';
import type { EditorState } from 'reducers/editor';
import { updateViewport, type LayersSettings, type Viewport } from 'reducers/map';
import { stdcmConfInitialState, updateStdcmLayers } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';
import useOutsideClick from 'utils/hooks/useOutsideClick';

import ButtonMapInfraErrors from './ButtonMapInfraErrors';
import MapButton from './MapButton';

type MapButtonsProps = {
  map?: MapRef;
  resetPitchBearing: () => void;
  closeFeatureInfoClickPopup?: () => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  withSearchButton?: boolean;
  withToggleLayersButton?: boolean;
  withInfraButton?: boolean;
  withMapKeyButton?: boolean;
  bearing: number;
  editorProps?: {
    toolState: CommonToolState;
    setToolState: (stateOrReducer: PartialOrReducer<CommonToolState>) => void;
    editorState: EditorState;
    activeTool: Tool<CommonToolState>;
  };
  compact?: boolean;
  viewPort: Viewport;
  isNewButtons?: boolean;
  layersSettings?: LayersSettings;
};

const ZOOM_DEFAULT = 5;
const ZOOM_DELTA = 1.5;
const MAP_POPOVERS = { SEARCH: 'SEARCH', SETTINGS: 'SETTINGS', KEY: 'KEY' };

export default function MapButtons({
  map,
  resetPitchBearing,
  closeFeatureInfoClickPopup,
  withInfraButton,
  withSearchButton = true,
  withToggleLayersButton = true,
  withMapKeyButton,
  bearing,
  editorProps,
  viewPort: viewportProps,
  zoomIn: zoomInProps,
  zoomOut: zoomOutProps,
  isNewButtons = false,
  compact,
  layersSettings,
}: MapButtonsProps) {
  const dispatch = useAppDispatch();
  const { isOpen, openModal } = useContext(ModalContext);
  const [openedPopover, setOpenedPopover] = useState<string | undefined>(undefined);
  const [viewport, setViewport] = useState(viewportProps);

  const rotationStyle = {
    transform: `translate(-40%, 0) rotate(${-bearing}deg)`,
    transformOrigin: 'center',
  };

  const toggleMapModal = useCallback((keyModal: string) => {
    setOpenedPopover((prevOpenedPopover) =>
      keyModal !== prevOpenedPopover ? keyModal : undefined
    );
  }, []);

  const openMapSettingsModal = useCallback(() => {
    if (editorProps) {
      const { activeTool, setToolState, editorState, toolState } = editorProps;
      openModal(
        <LayersModal
          initialLayers={editorState.editorLayers}
          frozenLayers={activeTool.requiredLayers}
          selection={
            activeTool.id === 'select-items' ? (toolState as SelectionState).selection : undefined
          }
          onChange={({ newLayers }) => {
            if (activeTool.id === 'select-items') {
              const currentState = toolState as SelectionState;
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
    } else if (compact) {
      openModal(
        <StdcmLayersModal
          initialLayers={layersSettings ?? stdcmConfInitialState.layersSettings}
          onChange={(newLayers) => {
            dispatch(updateStdcmLayers(newLayers));
          }}
        />,
        'lg'
      );
    } else {
      toggleMapModal('SETTINGS');
    }
  }, [editorProps, openModal, toggleMapModal, dispatch, layersSettings]);

  const mapButtonsRef = useRef<HTMLDivElement | null>(null);

  // Close the pop up of the map
  useEffect(() => {
    if (closeFeatureInfoClickPopup) closeFeatureInfoClickPopup();
  }, [openedPopover, isOpen]);

  // Close the Popover when opening modal
  useEffect(() => {
    setOpenedPopover(undefined);
  }, [isOpen]);

  useEffect(() => {
    setViewport(viewportProps);
  }, [viewportProps]);

  useOutsideClick(mapButtonsRef, () => setOpenedPopover(undefined));

  const zoomIn = useCallback(() => {
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
  }, [dispatch, viewport]);

  const zoomOut = useCallback(() => {
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
  }, [dispatch, viewport]);

  return (
    <div ref={mapButtonsRef}>
      <div
        className={cx(isNewButtons ? 'new-btn-map-container' : 'btn-map-container', {
          editor: !!editorProps,
        })}
      >
        <MapButton
          onClick={zoomInProps ?? zoomIn}
          isNewButton={isNewButtons}
          icon={<ZoomIn />}
          tooltipKey="common.zoom-in"
        />
        <MapButton
          onClick={zoomOutProps ?? zoomOut}
          isNewButton={isNewButtons}
          icon={<ZoomOut />}
          tooltipKey="common.zoom-out"
        />
        <MapButton
          onClick={resetPitchBearing}
          isNewButton={isNewButtons}
          icon={
            <>
              <span className="compass-needle" style={rotationStyle}>
                <CompassNeedleV2 />
              </span>
              <span className="compass-cardinal">
                <CompassCardinalV2 />
              </span>
            </>
          }
          tooltipKey="common.reset-north"
          extraClasses={isNewButtons ? 'new-btn-map-resetviewport' : 'btn-map-resetviewport'}
        />
        {withSearchButton && (
          <MapButton
            onClick={() => toggleMapModal('SEARCH')}
            isNewButton={isNewButtons}
            icon={<Search />}
            tooltipKey="common.search"
          />
        )}
        {withToggleLayersButton && (
          <MapButton
            onClick={openMapSettingsModal}
            isNewButton={isNewButtons}
            icon={<Sliders />}
            tooltipKey="Editor.nav.toggle-layers"
          />
        )}
        {withMapKeyButton && (
          <MapButton
            onClick={() => toggleMapModal('KEY')}
            isNewButton={isNewButtons}
            icon={<Info />}
            tooltipKey="common.help-legend"
          />
        )}
        {withInfraButton && <ButtonMapInfras isInEditor={!!editorProps} />}
        {editorProps && <ButtonMapInfraErrors editorState={editorProps.editorState} />}
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
