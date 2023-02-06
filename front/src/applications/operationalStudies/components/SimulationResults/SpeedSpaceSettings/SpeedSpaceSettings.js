import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function SpeedSpaceSettings(props) {
  const { showSettings, speedSpaceSettings, onSetSettings } = props;

  const [settings, setSettings] = useState(speedSpaceSettings);

  const toggleSetting = (settingName, settings) => {
    const newSettings = Object.assign({}, settings);
    newSettings[settingName] = !settings[settingName];
    setSettings(newSettings);
    onSetSettings(newSettings);
  };
  const { t } = useTranslation(['simulation']);

  return (
    <div
      className={`${showSettings ? 'ml-5' : ''} showSettings`}
      style={showSettings ? { width: 'auto' } : { width: 0 }}
    >
      <div className="h2 d-flex align-items-center">{t('speedSpaceSettings.display')}</div>
      <CheckboxRadioSNCF
        id="speedSpaceSettings-altitude"
        name="speedSpaceSettings-altitude"
        label={t('speedSpaceSettings.altitude')}
        checked={settings.altitude}
        onChange={() => toggleSetting('altitude', settings)}
        type="checkbox"
      />
      <CheckboxRadioSNCF
        id="speedSpaceSettings-curves"
        name="speedSpaceSettings-curves"
        label={t('speedSpaceSettings.curves')}
        checked={settings.curves}
        onChange={() => toggleSetting('curves', settings)}
        type="checkbox"
      />
      <CheckboxRadioSNCF
        id="speedSpaceSettings-maxSpeed"
        name="speedSpaceSettings-maxSpeed"
        label={t('speedSpaceSettings.maxSpeed')}
        checked={settings.maxSpeed}
        onChange={() => toggleSetting('maxSpeed', settings)}
        type="checkbox"
      />
      <CheckboxRadioSNCF
        id="speedSpaceSettings-slopes"
        name="speedSpaceSettings-slopes"
        label={t('speedSpaceSettings.slopes')}
        checked={settings.slopes}
        onChange={() => toggleSetting('slopes', settings)}
        type="checkbox"
      />
      <CheckboxRadioSNCF
        id="speedSpaceSettings-electricalProfiles"
        name="speedSpaceSettings-electricalProfiles"
        label={t('speedSpaceSettings.electricalProfiles')}
        checked={settings.electricalProfiles}
        onChange={() => {
          toggleSetting('electricalProfiles', settings);
        }}
        type="checkbox"
      />
    </div>
  );
}

SpeedSpaceSettings.propTypes = {
  showSettings: PropTypes.bool,
  speedSpaceSettings: PropTypes.object,
  onSetSettings: PropTypes.func,
};

SpeedSpaceSettings.defaultProps = {
  showSettings: false,
  speedSpaceSettings: {
    altitude: false,
    curves: false,
    settings: false,
    slopes: false,
    electricalProfiles: false,
  },
  onSetSettings: () => {},
};
