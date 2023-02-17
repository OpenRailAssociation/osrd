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

export default function MapButtons(props) {
  const { resetPitchBearing, withInfraButton } = props;
  const featureInfoClick = useSelector(getFeatureInfoClick);
  const dispatch = useDispatch();

  const mapModalKeywords = {
    search: false,
    settings: false,
    key: false,
  };

  const [showMapModal, setShowMapModal] = useState(mapModalKeywords);
  const toggleMapModal = (keyModal) => {
    setShowMapModal({
      ...mapModalKeywords,
      [keyModal]: !showMapModal[keyModal],
    });

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
    if (
      Object.values(showMapModal).some((show) => show === true) &&
      !mapButtonsRef.current.contains(e.target)
    ) {
      setShowMapModal({ ...mapModalKeywords });
    }
  };

  useOutsideClick(mapButtonsRef, handleClickOutside);

  return (
    <div ref={mapButtonsRef}>
      <div className="btn-map-container">
        <ButtonMapSearch toggleMapSearch={() => toggleMapModal('search')} />
        <ButtonMapSettings toggleMapSettings={() => toggleMapModal('settings')} />
        <ButtonMapKey toggleMapKey={() => toggleMapModal('key')} />
        <ButtonResetViewport updateLocalViewport={resetPitchBearing} />
        <ButtonFullscreen />
        {withInfraButton && <ButtonMapInfras />}
      </div>
      {showMapModal.search && <MapSearch toggleMapSearch={() => toggleMapModal('search')} />}
      {showMapModal.settings && (
        <MapSettings toggleMapSettings={() => toggleMapModal('settings')} />
      )}
      {showMapModal.key && <MapKey toggleMapKey={() => toggleMapModal('key')} />}
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
