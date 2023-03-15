import React, { useRef, useState, useContext, useEffect } from 'react';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

// Buttons
import ButtonMapSearch from 'common/Map/Buttons/ButtonMapSearch';
import ButtonMapSettings from 'common/Map/Buttons/ButtonMapSettings';
import ButtonMapKey from 'common/Map/Buttons/ButtonMapKey';
import ButtonResetViewport from 'common/Map/Buttons/ButtonResetViewport';
import ButtonFullscreen from 'common/ButtonFullscreen';

// Map modals
import MapSearch from 'common/Map/Search/MapSearch';
import MapSettings from 'common/Map/Settings/MapSettings';
import MapKey from 'common/Map/MapKey';
import { useSelector, useDispatch } from 'react-redux';
import { updateFeatureInfoClickOSRD } from 'reducers/osrdconf';

import { getFeatureInfoClick } from 'reducers/osrdconf/selectors';
import useOutsideClick from 'utils/hooks/useOutsideClick';
import ButtonMapInfras from './ButtonMapInfras';

type Props = {
  resetPitchBearing: () => void;
  withFullscreenButton?: boolean;
  withInfraButton?: boolean;
};

const MAP_POPOVERS = { SEARCH: 'SEARCH', SETTINGS: 'SETTINGS', KEY: 'KEY' };
export default function MapButtons({
  resetPitchBearing,
  withFullscreenButton,
  withInfraButton,
}: Props) {
  const featureInfoClick = useSelector(getFeatureInfoClick);
  const dispatch = useDispatch();
  const { isOpen } = useContext(ModalContext);

  const [openedPopover, setOpenedPopover] = useState<string | undefined>(undefined);

  const toggleMapModal = (keyModal: string) => {
    setOpenedPopover(keyModal !== openedPopover ? keyModal : undefined);
  };

  const mapButtonsRef = useRef<HTMLDivElement | null>(null);

  // Close the pop up of the map
  useEffect(() => {
    if (featureInfoClick.displayPopup) {
      dispatch(
        updateFeatureInfoClickOSRD({
          displayPopup: false,
          feature: undefined,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedPopover, isOpen]);

  // Close the Popover when opening modal
  useEffect(() => {
    setOpenedPopover(undefined);
  }, [isOpen]);

  useOutsideClick(mapButtonsRef, () => setOpenedPopover(undefined));

  return (
    <div ref={mapButtonsRef}>
      <div className="btn-map-container">
        <ButtonMapSearch toggleMapSearch={() => toggleMapModal('SEARCH')} />
        <ButtonMapSettings toggleMapSettings={() => toggleMapModal('SETTINGS')} />
        <ButtonMapKey toggleMapKey={() => toggleMapModal('KEY')} />
        <ButtonResetViewport updateLocalViewport={resetPitchBearing} />
        {withFullscreenButton && <ButtonFullscreen />}
        {withInfraButton && <ButtonMapInfras />}
      </div>
      {openedPopover === MAP_POPOVERS.SEARCH && (
        <MapSearch closeMapSearchPopUp={() => setOpenedPopover(undefined)} />
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
