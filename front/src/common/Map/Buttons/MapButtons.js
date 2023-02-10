import React, { useState } from 'react';
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
import ButtonMapInfras from './ButtonMapInfras';

export default function MapButtons(props) {
  const { resetPitchBearing, withInfraButton } = props;
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMapKey, setShowMapKey] = useState(false);

  return (
    <>
      <div className="btn-map-container">
        <ButtonMapSearch toggleMapSearch={() => setShowSearch(!showSearch)} />
        <ButtonMapSettings toggleMapSettings={() => setShowSettings(!showSettings)} />
        <ButtonMapKey toggleMapKey={() => setShowMapKey(!showMapKey)} />
        <ButtonResetViewport updateLocalViewport={resetPitchBearing} />
        <ButtonFullscreen />
        {withInfraButton && <ButtonMapInfras />}
      </div>
      <MapSearch active={showSearch} toggleMapSearch={() => setShowSearch(!showSearch)} />
      <MapSettings active={showSettings} toggleMapSettings={() => setShowSettings(!showSettings)} />
      {showMapKey && <MapKey toggleMapKey={() => setShowMapKey(!showMapKey)} />}
    </>
  );
}

MapButtons.defaultProps = {
  withInfraButton: false,
};

MapButtons.propTypes = {
  resetPitchBearing: PropTypes.func.isRequired,
  withInfraButton: PropTypes.bool,
};
