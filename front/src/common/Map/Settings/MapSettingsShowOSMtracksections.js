import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateShowOSMtracksections } from 'reducers/map';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';

export default function MapSettingsShowOSMtracksections() {
  const { t } = useTranslation(['map-settings']);
  const { showOSMtracksections } = useSelector((state) => state.map);
  const dispatch = useDispatch();

  return (
    <div className="d-flex align-items-center">
      <SwitchSNCF
        id="showosmtracksectionswitch"
        type={SWITCH_TYPES.switch}
        name="showosmtracksectionswitch"
        onChange={() => dispatch(updateShowOSMtracksections(!showOSMtracksections))}
        checked={showOSMtracksections}
      />
      <span className="ml-2">{t('showOSMtracksections')}</span>
    </div>
  );
}
