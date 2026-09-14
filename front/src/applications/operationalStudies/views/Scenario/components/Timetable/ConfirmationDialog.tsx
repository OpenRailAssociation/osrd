import { useState } from 'react';

import { Button, Dialog } from '@osrd-project/ui-core';
import { Blocked } from '@osrd-project/ui-icons';
import cx from 'classnames';

import { getErrorMessage } from 'utils/error';

type ConfirmationDialogProps = {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  labels: {
    title: string;
    texts: string[];
    submit: string;
    cancel: string;
  };
  submitDataTestID?: string;
};

const ConfirmationDialog = ({
  onCancel,
  onConfirm,
  labels,
  submitDataTestID,
}: ConfirmationDialogProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
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
              onClick={handleConfirm}
              isLoading={loading}
              variant="Destructive"
              dataTestID={submitDataTestID}
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

export default ConfirmationDialog;
