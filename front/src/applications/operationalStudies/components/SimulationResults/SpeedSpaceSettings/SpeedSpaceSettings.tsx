import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SpeedSpaceSettingKey, SPEED_SPACE_SETTINGS_KEYS } from 'reducers/osrdsimulation/types';

interface SpeedSpaceSettingsProps {
  showSettings: boolean;
  speedSpaceSettings: { [key in SPEED_SPACE_SETTINGS_KEYS]: boolean };
  onSetSettings: (newSettings: { [key in SPEED_SPACE_SETTINGS_KEYS]: boolean }) => void;
}

export default function SpeedSpaceSettings({
  showSettings,
  speedSpaceSettings,
  onSetSettings,
}: SpeedSpaceSettingsProps) {
  const { t } = useTranslation(['simulation']);
  const [settings, setSettings] = useState(speedSpaceSettings);

  const toggleSetting = (settingName: SpeedSpaceSettingKey) => {
    const newSettings = {
      ...settings,
      [settingName]: !settings[settingName],
    };
    setSettings(newSettings);
    onSetSettings(newSettings);
  };

  const getCheckboxRadio = useCallback(
    (settingKey: SpeedSpaceSettingKey, isChecked: boolean) => (
      <CheckboxRadioSNCF
        id={`speedSpaceSettings-${settingKey}`}
        name={`speedSpaceSettings-${settingKey}`}
        label={t(`speedSpaceSettings.${settingKey}`)}
        checked={isChecked}
        onChange={() => toggleSetting(settingKey)}
        type="checkbox"
      />
    ),
    [t, toggleSetting]
  );

  return (
    <div
      className={`${showSettings ? 'ml-5' : ''} showSettings`}
      style={showSettings ? { width: 'auto' } : { width: 0 }}
    >
      <div className="h2 d-flex align-items-center">{t('speedSpaceSettings.display')}</div>
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.ALTITUDE, settings.altitude)}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.CURVES, settings.curves)}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.MAX_SPEED, settings.maxSpeed)}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.SLOPES, settings.slopes)}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.ELECTRICAL_PROFILES, settings.electricalProfiles)}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.POWER_RESTRICTION, settings.powerRestriction)}
    </div>
  );
}
