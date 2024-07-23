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

      <div className="buttons-list">
        <Button variant="Cancel" label={t('startIncompatible')} />
        <Button variant="Cancel" label={t('arrivalIncompatible')} />
        <Button variant="Cancel" label={t('unqualifiedDriver')} />
        <Button variant="Cancel" label={t('other')} />
      </div>
    </div>
  );
};

export default StdcmUpgrade;
