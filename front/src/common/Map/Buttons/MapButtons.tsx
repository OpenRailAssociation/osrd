import { useRef, useState, useContext, useEffect, useCallback } from 'react';

import { useOutsideClick } from '@osrd-project/ui-core';
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
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { MapRef } from 'react-map-gl/maplibre';

import { EDITOAST_TO_LAYER_DICT, type EditoastType } from 'applications/editor/consts';
import type { SelectionState } from 'applications/editor/tools/selection/types';
import type { CommonToolState } from 'applications/editor/tools/types';
import type { PartialOrReducer, Tool } from 'applications/editor/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import {
  getEditorLayersFromLayersSetting,
  getLayersSettingsFromEditorLayers,
} from 'applications/editor/utils';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import ButtonMapInfras from 'common/Map/Buttons/ButtonMapInfras';
import LayersModal from 'common/Map/components/LayersModal';
import MapKey from 'common/Map/MapKey';
import MapSearch from 'common/Map/Search/MapSearch';
import { useMapSettingsActions } from 'reducers/commonMap';
import type { LayersSettings, Viewport } from 'reducers/commonMap/types';
import { type EditorState } from 'reducers/editor';
import { useAppDispatch } from 'store';

import ButtonMapInfraErrors from './ButtonMapInfraErrors';
import MapButton from './MapButton';
import { MapContextProvider, useMapContext } from '../useMapContext';

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
  compactModal?: boolean;
  viewPort: Viewport;
  isNewButtons?: boolean;
  layersModalContainer?: Element | null;
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
  compactModal = false,
  layersModalContainer,
}: MapButtonsProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { updateViewport } = useMapSettingsActions();
  const { infraId, updateMapSettings, ...mapSettings } = useMapContext();

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

  const [showLayersModal, setShowLayersModal] = useState(false);

  const openMapSettingsModal = useCallback(() => {
    let frozenLayers: LayersSettings | undefined;
    let selection: EditorEntity[] | undefined;
    let onChange: ((newLayersSettings: LayersSettings) => void) | undefined;

    if (editorProps) {
      const { activeTool, setToolState, toolState } = editorProps;
      frozenLayers = getLayersSettingsFromEditorLayers(activeTool.requiredLayers);
      selection =
        activeTool.id === 'select-items' ? (toolState as SelectionState).selection : undefined;
      onChange = (newLayersSettings) => {
        if (activeTool.id === 'select-items') {
          const currentState = toolState as SelectionState;
          const newLayers = getEditorLayersFromLayersSetting(newLayersSettings);
          setToolState({
            ...currentState,
            selection: currentState.selection.filter((entity) =>
              EDITOAST_TO_LAYER_DICT[entity.objType as EditoastType].every((layer) =>
                newLayers.has(layer)
              )
            ),
          } as SelectionState);
        }
      };
    }

    openModal(
      <MapContextProvider
        infraId={infraId}
        mapSettings={mapSettings}
        updateMapSettings={updateMapSettings}
      >
        <LayersModal
          compactModal={compactModal}
          disabledLayers={frozenLayers}
          onChange={onChange}
          selection={selection}
          showTrackSectionToggle={!!editorProps}
        />{' '}
      </MapContextProvider>,
      'lg'
    );
  }, [
    editorProps,
    openModal,
    compactModal,
    layersModalContainer,
    mapSettings,
    infraId,
    updateMapSettings,
  ]);

  const mapButtonsRef = useRef<HTMLDivElement>(null);

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
    dispatch(updateViewport({ zoom: (viewport.zoom || ZOOM_DEFAULT) + ZOOM_DELTA }));
  }, [dispatch, viewport]);

  const zoomOut = useCallback(() => {
    dispatch(updateViewport({ zoom: (viewport.zoom || ZOOM_DEFAULT) - ZOOM_DELTA }));
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
          tooltip={t('common.zoom-in')}
        />
        <MapButton
          onClick={zoomOutProps ?? zoomOut}
          isNewButton={isNewButtons}
          icon={<ZoomOut />}
          tooltip={t('common.zoom-out')}
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
          tooltip={t('common.map-actions.reset-north')}
          extraClasses={isNewButtons ? 'new-btn-map-resetviewport' : 'btn-map-resetviewport'}
        />
        {withSearchButton && (
          <MapButton
            onClick={() => toggleMapModal('SEARCH')}
            isNewButton={isNewButtons}
            icon={<Search />}
            tooltip={t('common.search')}
          />
        )}
        {withToggleLayersButton && (
          <MapButton
            onClick={openMapSettingsModal}
            isNewButton={isNewButtons}
            icon={<Sliders />}
            tooltip={t('map.layers-modal.toggle-layers')}
          />
        )}
        {withMapKeyButton && (
          <MapButton
            onClick={() => toggleMapModal('KEY')}
            isNewButton={isNewButtons}
            icon={<Info />}
            tooltip={t('common.map-actions.help-legend')}
          />
        )}
        {withInfraButton && <ButtonMapInfras isInEditor={!!editorProps} />}
        {editorProps && <ButtonMapInfraErrors editorState={editorProps.editorState} />}
      </div>
      {showLayersModal &&
        layersModalContainer &&
        createPortal(
          <div
            className="menu-overlay"
            role="menu"
            tabIndex={-1}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowLayersModal(false);
            }}
          >
            <div className="layers-modal">
              <LayersModal
                compactModal={compactModal}
                closePortalModal={() => setShowLayersModal(false)}
                showTrackSectionToggle={!!editorProps}
              />
            </div>
          </div>,
          layersModalContainer
        )}
      {openedPopover === MAP_POPOVERS.SEARCH && (
        <MapSearch
          map={map}
          closeMapSearchPopUp={() => setOpenedPopover(undefined)}
          mapSettings={mapSettings}
        />
      )}
      {openedPopover === MAP_POPOVERS.KEY && (
        <MapKey closeMapKeyPopUp={() => setOpenedPopover(undefined)} />
      )}
    </div>
  );
}
