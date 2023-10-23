import React, { FC, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { fromPairs } from 'lodash';

import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import stopsIcon from 'assets/pictures/layersicons/layer_stops.svg';
import lightsIcon from 'assets/pictures/layersicons/layer_signal.svg';
import { updateSignalsSettings } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';
import { RootState } from 'reducers';

type SettingsSignals = RootState['map']['signalsSettings'];
const SIGNAL_SETTINGS: Array<keyof SettingsSignals> = ['lights']; // 'all', 'stops' temporarely desactivated
const CONSTS_SVG: Partial<Record<keyof SettingsSignals, string>> = {
  stops: stopsIcon,
  lights: lightsIcon,
};

function switchAllSettings(
  settingSwitch: keyof SettingsSignals,
  stateOfSettings: SettingsSignals
): SettingsSignals {
  return fromPairs(
    SIGNAL_SETTINGS.map((s) => [s, !stateOfSettings[settingSwitch]])
  ) as SettingsSignals;
}

function checkAllSettingsAreTheSame(
  settingSwitch: keyof SettingsSignals,
  stateOfSettings: SettingsSignals
): boolean {
  const filteredSettingKeys = Object.keys(stateOfSettings).filter(
    (key) => key !== settingSwitch && key !== 'all'
  ) as Array<keyof SettingsSignals>;
  const settingValues = filteredSettingKeys.map((settingKey) => stateOfSettings[settingKey]);
  return settingValues.every((settingValue) => settingValue === !stateOfSettings[settingSwitch]);
}

const MapSettingsSignals: FC<unknown> = () => {
  const { signalsSettings } = useSelector(getMap);
  const dispatch = useDispatch();
  const { t } = useTranslation(['map-settings']);

  const setSignalsList = useCallback(
    (setting: keyof SettingsSignals) => {
      let newSettings;

      if (setting === 'all' || checkAllSettingsAreTheSame(setting, signalsSettings)) {
        newSettings = switchAllSettings(setting, signalsSettings);
      } else {
        newSettings = {
          ...signalsSettings,
          [setting]: !signalsSettings[setting],
        };
      }
      dispatch(updateSignalsSettings(newSettings));
    },
    [dispatch, signalsSettings]
  );

  return (
    <div className="row">
      {SIGNAL_SETTINGS.map((setting) => (
        <div className="col-lg-6" key={setting}>
          <div className="d-flex align-items-center mt-1">
            <SwitchSNCF
              type="switch"
              onChange={() => setSignalsList(setting)}
              name={`map-settings-${setting}`}
              id={`map-settings-${setting}`}
              checked={signalsSettings[setting]}
            />
            {setting === 'all' ? (
              <small className="ml-2 font-weight-bold">{t('all')}</small>
            ) : (
              <>
                <img
                  className="mx-1"
                  src={CONSTS_SVG[setting]}
                  alt={`${setting} Icon`}
                  height="16"
                />
                <small>{t(setting)}</small>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MapSettingsSignals;
