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
        <div className="h2">{t('map-settings:mapSettings')}</div>
        <MapSettingsTrackSources />
        <div className="my-1" />
        <MapSettingsMapStyle />
        <div className="my-1" />
        <MapSettingsBackgroundSwitches />
        <div
          className="mb-1 mt-3 border-bottom d-flex align-items-center sub-section-title"
          onClick={() => toogleShowSettings(setShowSettingsSignals)}
          role="button"
          tabIndex={0}
        >
          {t('map-settings:signalisation')}
          <i
            className={`${showSettingsSignals ? 'open' : ''} icons-arrow-down icons-size-20px`}
            aria-hidden="true"
          />
        </div>
        {showSettingsSignals && <MapSettingsSignals />}
        <div
          className="mb-1 mt-3 border-bottom d-flex align-items-center sub-section-title"
          onClick={() => toogleShowSettings(setShowSettingsLayers)}
          role="button"
          tabIndex={0}
        >
          {t('map-settings:layers')}
          <i
            className={`${showSettingsLayers ? 'open' : ''} icons-arrow-down icons-size-20px`}
            aria-hidden="true"
          />
        </div>
        {showSettingsLayers && <MapSettingsLayers />}
        <div
          className="mb-1 mt-3 border-bottom d-flex align-items-center sub-section-title"
          onClick={() => toogleShowSettings(setShowSettingsSpeedLimits)}
          role="button"
          tabIndex={0}
        >
          {t('map-settings:speedlimits')}
          <i
            className={`${showSettingsSpeedLimits ? 'open' : ''} icons-arrow-down icons-size-20px`}
            aria-hidden="true"
          />
        </div>
        {showSettingsSpeedLimits && <MapSettingsSpeedLimits />}
        <div className="mt-2 d-flex flex-row-reverse w-100">
          <button className="btn btn-secondary btn-sm" type="button" onClick={toggleMapSettings}>
            {t('translation:common.close')}
          </button>
        </div>
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
