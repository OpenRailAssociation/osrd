import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import {
  ElectrificationRange,
  LightRollingStock,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getSelectedTrain } from 'reducers/osrdsimulation/selectors';
import { SpeedSpaceSettingKey, SPEED_SPACE_SETTINGS_KEYS } from 'reducers/osrdsimulation/types';

type RollingStockMode = {
  [key: string]: {
    is_electric: boolean;
  };
};
interface SpeedSpaceSettingsProps {
  // rollingStockMode: RollingStockMode;
  electrificationRanges: ElectrificationRange[];
  showSettings: boolean;
  speedSpaceSettings: { [key in SPEED_SPACE_SETTINGS_KEYS]: boolean };
  onSetSettings: (newSettings: { [key in SPEED_SPACE_SETTINGS_KEYS]: boolean }) => void;
}

export default function SpeedSpaceSettings({
  // rollingStockMode,
  electrificationRanges,
  showSettings,
  speedSpaceSettings,
  onSetSettings,
}: SpeedSpaceSettingsProps) {
  const { t } = useTranslation(['simulation']);
  const [settings, setSettings] = useState(speedSpaceSettings);

  const selectedTrain = useSelector(getSelectedTrain);

  const [rollingStock, setRollingStock] = useState<LightRollingStock>();

  const [getTrainSchedule] = osrdEditoastApi.endpoints.getTrainScheduleById.useLazyQuery();

  const [getRollingStock] = osrdEditoastApi.endpoints.getLightRollingStockById.useLazyQuery();

  useEffect(() => {
    if (selectedTrain) {
      getTrainSchedule({ id: selectedTrain.id })
        .unwrap()
        .then((trainSchedule) => {
          getRollingStock({ id: trainSchedule.rolling_stock_id })
            .unwrap()
            .then((lightRollingStock) => {
              setRollingStock(lightRollingStock);
            });
        });
    }
  }, [selectedTrain]);

  console.log('speedspace settings - elec ranges : ', electrificationRanges);

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
      className={`${showSettings ? 'ml-5' : ''} showSettings`}
      style={showSettings ? { width: 'auto' } : { width: 0 }}
    >
      <div className="h2 d-flex align-items-center">{t('speedSpaceSettings.display')}</div>
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.ALTITUDE, settings.altitude)}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.CURVES, settings.curves)}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.MAX_SPEED, settings.maxSpeed)}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.SLOPES, settings.slopes)}
      {rollingStock &&
        getCheckboxRadio(
          SPEED_SPACE_SETTINGS_KEYS.ELECTRICAL_PROFILES,
          settings.electricalProfiles,
          isOnlyThermal(rollingStock.effort_curves.modes)
        )}
      {getCheckboxRadio(SPEED_SPACE_SETTINGS_KEYS.POWER_RESTRICTION, settings.powerRestriction)}
    </div>
  );
}
