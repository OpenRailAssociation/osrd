import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';

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

const MAP_POPOVERS = { SEARCH: 'SEARCH', SETTINGS: 'SETTINGS', KEY: 'KEY' };
export default function MapButtons(props) {
  const { resetPitchBearing, withInfraButton } = props;
  const featureInfoClick = useSelector(getFeatureInfoClick);
  const dispatch = useDispatch();

  const [openedPopover, setOpenedPopover] = useState(undefined);

  const toggleMapModal = (keyModal) => {
    setOpenedPopover(keyModal !== openedPopover ? keyModal : undefined);

    // Close the pop up of the map
    if (featureInfoClick.displayPopup) {
      dispatch(
        updateFeatureInfoClickOSRD({
          displayPopup: false,
          feature: undefined,
        })
      );
    }
  };

  const mapButtonsRef = useRef(null);
  const handleClickOutside = (e) => {
    if (openedPopover && !mapButtonsRef.current.contains(e.target)) {
      setOpenedPopover(undefined);
    }
  };

  useOutsideClick(mapButtonsRef, handleClickOutside);

  return (
    <div ref={mapButtonsRef}>
      <div className="btn-map-container">
        <ButtonMapSearch toggleMapSearch={() => toggleMapModal('SEARCH')} />
        <ButtonMapSettings toggleMapSettings={() => toggleMapModal('SETTINGS')} />
        <ButtonMapKey toggleMapKey={() => toggleMapModal('KEY')} />
        <ButtonResetViewport updateLocalViewport={resetPitchBearing} />
        <ButtonFullscreen />
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

MapButtons.defaultProps = {
  withInfraButton: false,
};

MapButtons.propTypes = {
  resetPitchBearing: PropTypes.func.isRequired,
  withInfraButton: PropTypes.bool,
};
