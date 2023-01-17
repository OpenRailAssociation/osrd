import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateSignalsSettings } from 'reducers/map';
import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import stopsIcon from 'assets/pictures/layersicons/layer_stops.svg';
import lightsIcon from 'assets/pictures/layersicons/layer_signal.svg';

export default function MapSettingsSignals() {
  const { signalsSettings } = useSelector((state) => state.map);
  const dispatch = useDispatch();
  const { t } = useTranslation(['map-settings']);
  const CONSTS_SETTINGS = ['all', 'stops', 'lights'];
  const CONSTS_SVG = {
    stops: stopsIcon,
    lights: lightsIcon,
  };

  const switchAllSettings = (settingSwitch, stateOfSettings) => {
    const allSettings = {};

    CONSTS_SETTINGS.forEach((settingKey) => {
      allSettings[settingKey] = !stateOfSettings[settingSwitch];
    });

    return allSettings;
  };

  const checkedSettings = (settingSwitch, stateOfSettings) => {
    const filteredSettingKeys = Object.keys(stateOfSettings).filter(
      (key) => key !== settingSwitch && key !== 'all'
    );
    const settingValues = filteredSettingKeys.map((settingKey) => stateOfSettings[settingKey]);
    return settingValues.every((settingValue) => settingValue === !stateOfSettings[settingSwitch]);
  };

  const setSignalsList = (setting) => {
    let newSettings;

    if (setting === 'all' || checkedSettings(setting, signalsSettings)) {
      newSettings = switchAllSettings(setting, signalsSettings);
    } else {
      newSettings = {
        ...signalsSettings,
        [setting]: !signalsSettings[setting],
      };
    }
    dispatch(updateSignalsSettings(newSettings));
  };

  return (
    <div className="row">
      {CONSTS_SETTINGS.map((setting) => (
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
                  className="mx-2"
                  src={CONSTS_SVG[setting]}
                  alt={`${setting} Icon`}
                  height="20"
                />
                <small>{t(setting)}</small>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
