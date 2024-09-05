import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import electricalProfilesIcon from 'assets/pictures/components/electricalProfiles.svg';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { useAppDispatch } from 'store';

export default function ElectricalProfiles() {
  const { getUsingElectricalProfiles } = useOsrdConfSelectors();
  const { toggleUsingElectricalProfiles } = useOsrdConfActions();
  const dispatch = useAppDispatch();
  const usingElectricalProfiles = useSelector(getUsingElectricalProfiles);
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  return (
    <div className="osrd-config-item-container d-flex align-items-center mb-2">
      <img className="mr-2" src={electricalProfilesIcon} alt="infraIcon" width="32px" />
      <span className="mr-2 text-muted">{t('usingElectricalProfiles')}</span>
      <span className="ml-auto mt-1">
        <SwitchSNCF
          id="usingElectricalProfiles"
          type={SWITCH_TYPES.switch}
          name="usingElectricalProfiles"
          onChange={() => dispatch(toggleUsingElectricalProfiles())}
          checked={usingElectricalProfiles}
        />
      </span>
    </div>
  );
}
