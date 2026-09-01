import { useCallback } from 'react';

import { Button, Dialog } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

type OverwriteAllConfirmDialogProps = {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
};

const OverwriteAllConfirmDialog = ({
  count,
  onCancel,
  onConfirm,
}: OverwriteAllConfirmDialogProps) => {
  const { t } = useTranslation('translation', {
    keyPrefix: 'timeStopTable.columnHeader.overwriteAllConfirm',
  });

  const header = useCallback(
    () => <h5 data-testid="overwrite-all-confirm-header">{t('title')}</h5>,
    [t]
  );
  const footer = useCallback(
    () => (
      <div className="buttons">
        <Button
          variant="Cancel"
          label={t('cancel')}
          onClick={onCancel}
          dataTestID="overwrite-all-confirm-cancel-button"
        />
        <Button
          variant="Destructive"
          label={t('confirm')}
          onClick={onConfirm}
          dataTestID="overwrite-all-confirm-confirm-button"
        />
      </div>
    ),
    [onCancel, onConfirm, t]
  );

  return (
    <Dialog header={header()} footer={footer()}>
      <p className="overwrite-all-confirm-explanations" data-testid="overwrite-all-confirm-body">
        {t('body', { count })}
      </p>
    </Dialog>
  );
};

export default OverwriteAllConfirmDialog;
