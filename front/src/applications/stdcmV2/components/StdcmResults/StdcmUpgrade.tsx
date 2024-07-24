import React from 'react';

import { Button } from '@osrd-project/ui-core';
import { Comment } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

const StdcmUpgrade = () => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results.upgrade' });
  return (
    <div className="upgrade">
      <div className="text">
        <div className="title">
          {t('helpUs')}
          <div className="comment-icon">
            <Comment />
          </div>
        </div>
        <div>{t('reason')}</div>
      </div>
      {/* TODO: remove the disabling on buttons when functional */}
      <div className="buttons-list">
        <Button variant="Cancel" label={t('startIncompatible')} isDisabled />
        <Button variant="Cancel" label={t('arrivalIncompatible')} isDisabled />
        <Button variant="Cancel" label={t('unqualifiedDriver')} isDisabled />
        <Button variant="Cancel" label={t('other')} isDisabled />
      </div>
    </div>
  );
};

export default StdcmUpgrade;
