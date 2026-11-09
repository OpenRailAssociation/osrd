import { useCallback } from 'react';

import { Button, Dialog } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

type ServiceChangeWarningDialogProps = {
  exceptionsCount: number;
  linkingsCount: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ServiceChangeWarningDialog = ({
  exceptionsCount,
  linkingsCount,
  onCancel,
  onConfirm,
}: ServiceChangeWarningDialogProps) => {
  const { t } = useTranslation(['operational-studies'], {
    keyPrefix: 'manageTrainSchedule.trainHeader.serviceChangeWarning',
  });
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

  const explanationKey =
    linkingsCount === 0
      ? 'explanationsExceptions'
      : exceptionsCount === 0
        ? 'explanationsLinkings'
        : 'explanationsExceptionsAndLinkings';

  return (
    <Dialog header={header()} footer={footer()}>
      <p
        className="service-change-warning-explanations"
        data-testid="train-header-service-change-explanations"
      >
        {t(explanationKey, {
          exceptions: t('exceptionsCount', { count: exceptionsCount }),
          linkings: t('linkingsCount', { count: linkingsCount }),
        })}
      </p>
    </Dialog>
  );
};
