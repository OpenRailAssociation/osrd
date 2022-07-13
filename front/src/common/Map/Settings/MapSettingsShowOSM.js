import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateShowOSM } from 'reducers/map';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';

export default function MapSettingsShowOSM() {
  const { t } = useTranslation(['map-settings']);
  const { showOSM } = useSelector((state) => state.map);
  const dispatch = useDispatch();

  return (
    <div className="d-flex align-items-center">
      <SwitchSNCF
        id="showosmwitch"
        type={SWITCH_TYPES.switch}
        name="showosmwitch"
        onChange={() => dispatch(updateShowOSM(!showOSM))}
        checked={showOSM}
      />
      <span className="ml-2">{t('showOSM')}</span>
    </div>
  );
}
