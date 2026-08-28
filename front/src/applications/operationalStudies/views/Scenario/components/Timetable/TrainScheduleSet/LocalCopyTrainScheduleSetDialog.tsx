import { useCallback, useState } from 'react';

import { Button, Dialog } from '@osrd-project/ui-core';
import { Blocked } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { TrainScheduleSet } from 'common/api/osrdEditoastApi';
import { getErrorMessage } from 'utils/error';

type LocalCopyTrainScheduleSetDialogProps = {
  trainScheduleSet: TrainScheduleSet;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
};

const LocalCopyTrainScheduleSetDialog = ({
  trainScheduleSet,
  onCancel,
  onSubmit,
}: LocalCopyTrainScheduleSetDialogProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main.timetable.trainScheduleSets',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = useCallback(async () => {
    setLoading(true);
    try {
      await onSubmit();
      onCancel();
    } catch (e) {
      const errorMessage = getErrorMessage(e);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [onSubmit, onCancel]);

  return (
    <Dialog
      className={cx('train-schedule-set-dialog', { 'with-error': error !== null })}
      style={{ maxWidth: '680px' }}
      header={<h5>{t('transformToLocalCopyDialogTitle')}</h5>}
      footer={
        <>
          {error && (
            <div className="error">
              <Blocked variant="fill" size="lg" />
              <span>{error}</span>
            </div>
          )}
          <div className="buttons">
            <Button variant="Cancel" label={t('cancel')} onClick={onCancel} isDisabled={loading} />
            <Button label={t('transformToLocalCopySubmit')} onClick={confirm} isLoading={loading} />
          </div>
        </>
      }
    >
      <span>{t('transformToLocalCopyDialogText', { name: trainScheduleSet.name })}</span>
    </Dialog>
  );
};

export default LocalCopyTrainScheduleSetDialog;
