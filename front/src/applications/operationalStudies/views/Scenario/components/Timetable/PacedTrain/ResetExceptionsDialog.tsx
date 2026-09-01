import { useState } from 'react';

import { Button, Dialog } from '@osrd-project/ui-core';
import { Blocked } from '@osrd-project/ui-icons';
import cx from 'classnames';

import { getErrorMessage } from 'utils/error';

type ResetExceptionsDialogProps = {
  onCancel: () => void;
  onReset: () => Promise<void>;
  labels: {
    title: string;
    texts: string[];
    submit: string;
    cancel: string;
  };
};

const ResetExceptionsDialog = ({ onCancel, onReset, labels }: ResetExceptionsDialogProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    setLoading(true);
    try {
      await onReset();
      onCancel();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      className={cx('confirm-dialog', { 'with-error': error !== null })}
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
              onClick={handleReset}
              isLoading={loading}
              variant="Destructive"
              dataTestID="confirmation-modal-button"
            />
          </div>
        </>
      }
    >
      {labels.texts.map((text, index) => (
        <p key={index}>{text}</p>
      ))}
    </Dialog>
  );
};

export default ResetExceptionsDialog;
