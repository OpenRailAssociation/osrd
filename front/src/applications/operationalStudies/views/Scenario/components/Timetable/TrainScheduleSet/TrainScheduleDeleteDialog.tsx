import { useState } from 'react';

import { Button, Dialog } from '@osrd-project/ui-core';
import { Blocked } from '@osrd-project/ui-icons';
import cx from 'classnames';

import type { TrainScheduleSet } from 'common/api/osrdEditoastApi';
import { getErrorMessage } from 'utils/error';

type TrainScheduleDeleteDialogProps = {
  trainScheduleSet: TrainScheduleSet;
  onCancel: () => void;
  onDelete: (data: TrainScheduleSet) => Promise<void>;
  labels: {
    title: string;
    texts: string[];
    submit: string;
    cancel: string;
  };
};

const TrainScheduleDeleteDialog = ({
  trainScheduleSet,
  onCancel,
  onDelete,
  labels,
}: TrainScheduleDeleteDialogProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete(trainScheduleSet);
      onCancel();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      className={cx('train-schedule-set-dialog', 'delete-dialog', { 'with-error': error !== null })}
      header={<h5>{labels.title}</h5>}
      footer={
        <>
          {error && (
            <div className="error">
              <Blocked variant="fill" size="lg" />
              <span>{error}</span>
            </div>
          )}
          <div className="buttons">
            <Button
              variant="Cancel"
              label={labels.cancel}
              onClick={onCancel}
              isDisabled={loading}
            />
            <Button
              label={labels.submit}
              onClick={handleDelete}
              isLoading={loading}
              variant="Destructive"
            />
          </div>
        </>
      }
    >
      {
        <div className="train-schedule-set-remove-dialog-text">
          {labels.texts.map((text, index) => (
            <span key={index}>{text}</span>
          ))}
        </div>
      }
    </Dialog>
  );
};

export default TrainScheduleDeleteDialog;
