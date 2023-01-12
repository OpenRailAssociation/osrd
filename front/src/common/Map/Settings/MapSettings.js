import React, { useState } from 'react';
import PropTypes from 'prop-types';
import MapSettingsLayers from 'common/Map/Settings/MapSettingsLayers';
import MapSettingsMapStyle from 'common/Map/Settings/MapSettingsMapStyle';
import MapSettingsBackgroundSwitches from 'common/Map/Settings/MapSettingsBackgroundSwitches';
import MapSettingsSignals from 'common/Map/Settings/MapSettingsSignals';
import MapSettingsSpeedLimits from 'common/Map/Settings/MapSettingsSpeedLimits';
import MapSettingsTrackSources from 'common/Map/Settings/MapSettingsTrackSources';
import { useTranslation } from 'react-i18next';

export default function MapSettings(props) {
  const { active, toggleMapSettings } = props;
  const { t } = useTranslation(['translation', 'map-settings']);
  const [showSettingsSignals, setShowSettingsSignals] = useState(false);
  const [showSettingsLayers, setShowSettingsLayers] = useState(false);
  const [showSettingsSpeedLimits, setShowSettingsSpeedLimits] = useState(false);
  const toogleShowSettings = (setShowSettings) => {
    setShowSettings((prevState) => !prevState);
  };

  if (active) {
    return (
      <div className={`map-modal${active ? ' active' : ''}`}>
        <div className="d-flex justify-content-between align-items-start">
          <div className="h2">{t('map-settings:mapSettings')}</div>
          <button type="button" className="close" onClick={toggleMapSettings}>
            ×
          </button>
        </div>
        <MapSettingsTrackSources />
        <div className="my-1" />
        <MapSettingsMapStyle />
        <div className="my-1" />
        <MapSettingsBackgroundSwitches />
        <div className="mb-1 mt-3 border-bottom">{t('map-settings:signalisation')}</div>
        <MapSettingsSignals />
        <div className="mb-1 mt-3 border-bottom">{t('map-settings:layers')}</div>
        <MapSettingsLayers />
        <div className="mb-1 mt-3 border-bottom">{t('map-settings:speedlimits')}</div>
        <MapSettingsSpeedLimits />
      </div>
    );
  }
  return null;
}

MapSettings.propTypes = {
  active: PropTypes.bool,
  toggleMapSettings: PropTypes.func.isRequired,
};

MapSettings.defaultProps = {
  active: false,
};
