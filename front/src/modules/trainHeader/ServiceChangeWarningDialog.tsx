import { useCallback } from 'react';

import { Button, Dialog } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { getFeatureFlag } from 'reducers/user/userSelectors';

type ServiceChangeWarningDialogProps = {
  exceptionsCount: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ServiceChangeWarningDialog = ({
  exceptionsCount,
  onCancel,
  onConfirm,
}: ServiceChangeWarningDialogProps) => {
  const { t } = useTranslation(['operational-studies'], {
    keyPrefix: 'manageTrainSchedule.trainHeader.serviceChangeWarning',
  });
  const linkingsActivated = useSelector(getFeatureFlag('linkings'));
  const header = useCallback(
    () => <h5 data-testid="train-header-service-change-header">{t('header')}</h5>,
    [t]
  );
  const footer = useCallback(
    () => (
      <div className="buttons">
        <Button
          variant="Cancel"
          label={t('cancel')}
          onClick={onCancel}
          dataTestID="train-header-service-change-cancel-button"
        />
        <Button
          variant="Destructive"
          label={t('confirm')}
          onClick={onConfirm}
          dataTestID="train-header-service-change-confirm-button"
        />
      </div>
    ),
    [onCancel, onConfirm, t]
  );

  return (
    <Dialog header={header()} footer={footer()}>
      <p
        className="service-change-warning-explanations"
        data-testid="train-header-service-change-explanations"
      >
        {t(linkingsActivated ? 'explanationsWithLinkings' : 'explanations', {
          count: exceptionsCount,
        })}
      </p>
    </Dialog>
  );
};
