import React, { useCallback, useEffect, useState } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { ElectrificationRange, LightRollingStock } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import {
  type SpeedSpaceSettingKey,
  SPEED_SPACE_SETTINGS_KEYS,
} from 'reducers/osrdsimulation/types';

type RollingStockMode = {
  [key: string]: {
    is_electric: boolean;
  };
};
interface SpeedSpaceSettingsProps {
  electrificationRanges: ElectrificationRange[];
  showSettings: boolean;
  speedSpaceSettings: { [key in SPEED_SPACE_SETTINGS_KEYS]: boolean };
  trainRollingStock?: LightRollingStock;
  onSetSettings: (newSettings: { [key in SPEED_SPACE_SETTINGS_KEYS]: boolean }) => void;
}

const SpeedSpaceSettings = ({
  electrificationRanges,
  showSettings,
  speedSpaceSettings,
  onSetSettings,
  trainRollingStock,
}: SpeedSpaceSettingsProps) => {
  const { t } = useTranslation(['simulation']);
  const [settings, setSettings] = useState(speedSpaceSettings);

  const isOnlyThermal = (modes: RollingStockMode) =>
    !Object.keys(modes).some((mode) => mode !== 'thermal');

  const toggleSetting = (settingName: SpeedSpaceSettingKey) => {
    const newSettings = {
      ...settings,
      [settingName]: !settings[settingName],
    };
    setSettings(newSettings);
    onSetSettings(newSettings);
  };

  /**
   * Check if the train (in case of bimode rolling stock) runs in thermal mode on the whole path
   * @param electricRanges all of the different path's ranges.
   * If the range is electrified and the train us the eletrical mode, mode_handled is true
   */
  const runsOnlyThermal = (electricRanges: ElectrificationRange[]) =>
    !electricRanges.some(
      (range) =>
        range.electrificationUsage.object_type === 'Electrified' &&
        range.electrificationUsage.mode_handled
    );

  useEffect(() => {
    if (
      trainRollingStock &&
      isOnlyThermal(trainRollingStock.effort_curves.modes) &&
      settings.electricalProfiles
    ) {
      toggleSetting(SPEED_SPACE_SETTINGS_KEYS.ELECTRICAL_PROFILES);
    }
  }, [trainRollingStock]);

  const getCheckboxRadio = useCallback(
    (settingKey: SpeedSpaceSettingKey, isChecked: boolean, disabled?: boolean) => (
      <CheckboxRadioSNCF
        id={`speedSpaceSettings-${settingKey}`}
        name={`speedSpaceSettings-${settingKey}`}
        label={t(`speedSpaceSettings.${settingKey}`)}
        checked={isChecked}
        onChange={() => toggleSetting(settingKey)}
        type="checkbox"
        disabled={disabled}
      />
    ),
    [t, toggleSetting]
  );

  return (
    <div
      className={cx('showSettings', { 'ml-5': showSettings })}
      style={showSettings ? { width: 'auto' } : { width: 0 }}
    >
      <div className="h2 d-flex align-items-center">{t('speedSpaceSettings.display')}</div>
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.ALTITUDE, settings.altitude)}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.CURVES, settings.curves)}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.MAX_SPEED, settings.maxSpeed)}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.SLOPES, settings.slopes)}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.POWER_RESTRICTION, settings.powerRestriction)}
      {trainRollingStock &&
        getCheckboxRadio(
          SPEED_SPACE_SETTINGS_KEYS.ELECTRICAL_PROFILES,
          settings.electricalProfiles
        )}
    </div>
  );
};

export default SpeedSpaceSettings;
