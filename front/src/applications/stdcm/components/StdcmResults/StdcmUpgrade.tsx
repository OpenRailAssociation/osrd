import { Button } from '@osrd-project/ui-core';
import { Comment } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

const StdcmUpgrade = () => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results.upgrade' });
  const { stdcmName } = useDeploymentSettings() ?? { stdcmName: 'STDCM' };
  return (
    <div className="upgrade">
      <div className="text">
        <div className="title">
          {t('helpUs', { stdcmName })}
          <div className="comment-icon">
            <Comment />
          </div>
        </div>
        <div>{t('reason')}</div>
      </div>
      {/* TODO: remove the disabling on buttons when functional */}
      <div className="buttons-list">
        <Button variant="Cancel" label={t('startIncompatible')} isDisabled onClick={() => {}} />
        <Button variant="Cancel" label={t('arrivalIncompatible')} isDisabled onClick={() => {}} />
        <Button variant="Cancel" label={t('unqualifiedDriver')} isDisabled onClick={() => {}} />
        <Button variant="Cancel" label={t('other')} isDisabled onClick={() => {}} />
      </div>
    </div>
  );
};

export default StdcmUpgrade;
