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
import InfraSelector from 'common/InfraSelector/InfraSelector';
import TimetableSelector from 'common/TimetableSelector/TimetableSelector';
import ButtonMapInfras from './ButtonMapInfras';
import ButtonMapTimetables from './ButtonMapTimetables';

export default function MapButtons(props) {
  const { resetPitchBearing } = props;
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
        <ButtonMapInfras modalID="infra-selector-modal-map" />
        <ButtonMapTimetables modalID="timetable-selector-modal-map" />
      </div>
      <MapSearch active={showSearch} toggleMapSearch={() => setShowSearch(!showSearch)} />
      <MapSettings active={showSettings} toggleMapSettings={() => setShowSettings(!showSettings)} />
      <MapKey active={showMapKey} toggleMapKey={() => setShowMapKey(!showMapKey)} />
      <InfraSelector modalOnly modalID="infra-selector-modal-map" />
      <TimetableSelector modalOnly modalID="timetable-selector-modal-map" />
    </>
  );
}

MapButtons.propTypes = {
  resetPitchBearing: PropTypes.func.isRequired,
};
