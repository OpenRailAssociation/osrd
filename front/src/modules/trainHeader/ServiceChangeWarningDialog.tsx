import { useCallback } from 'react';

import { Button, Dialog } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

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
  const header = useCallback(() => <h5>{t('header')}</h5>, [t]);
  const footer = useCallback(
    () => (
      <div className="buttons">
        <Button variant="Cancel" label={t('cancel')} onClick={onCancel} />
        <Button variant="Destructive" label={t('confirm')} onClick={onConfirm} />
      </div>
    ),
    [onCancel, onConfirm, t]
  );

  return (
    <Dialog header={header()} footer={footer()}>
      <p className="service-change-warning-explanations">
        {t('explanations', { count: exceptionsCount })}
      </p>
    </Dialog>
  );
};
