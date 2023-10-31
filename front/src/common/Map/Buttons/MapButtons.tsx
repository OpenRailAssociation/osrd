import React, { useRef, useState, useContext, useEffect } from 'react';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import type { MapRef } from 'react-map-gl/maplibre';
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
import { useDispatch } from 'react-redux';

import useOutsideClick from 'utils/hooks/useOutsideClick';

type MapButtonsProps = {
  map?: MapRef;
  resetPitchBearing: () => void;
  closeFeatureInfoClickPopup?: () => void;
  withInfraButton?: boolean;
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
}: MapButtonsProps) {
  const dispatch = useDispatch();
  const { isOpen } = useContext(ModalContext);

  const [openedPopover, setOpenedPopover] = useState<string | undefined>(undefined);

  const toggleMapModal = (keyModal: string) => {
    setOpenedPopover(keyModal !== openedPopover ? keyModal : undefined);
  };

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
      <div className="btn-map-container">
        <ButtonZoomIn zoomIn={() => zoomIn()} />
        <ButtonZoomOut zoomOut={() => zoomOut()} />
        <ButtonResetViewport updateLocalViewport={resetPitchBearing} />
        <ButtonMapSearch toggleMapSearch={() => toggleMapModal('SEARCH')} />
        <ButtonMapSettings toggleMapSettings={() => toggleMapModal('SETTINGS')} />
        {withInfraButton && <ButtonMapInfras />}
        <ButtonMapKey toggleMapKey={() => toggleMapModal('KEY')} />
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
