import { useCallback, useState } from 'react';

import { Button, Dialog } from '@osrd-project/ui-core';
import { Blocked } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { noop } from 'lodash';

import type { TrainScheduleSetFormData } from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import type { CatalogEntry, TrainScheduleSet } from 'common/api/osrdEditoastApi';
import { getErrorMessage } from 'utils/error';

import TrainScheduleSetForm from './TrainScheduleSetForm';

type TrainScheduleSetDialogProps = {
  trainScheduleSet?: TrainScheduleSet;
  onCancel: () => void;
  onSubmit: (data: TrainScheduleSetFormData) => Promise<void>;
  catalogEntries: CatalogEntry[];
  checkNameInCatalogIsUniq?: (name: string, catalogId: number) => Promise<boolean>;
  labels: {
    title: string;
    submit: string;
    submitWithChanges?: string;
    cancel: string;
  };
};

const TrainScheduleSetDialog = ({
  trainScheduleSet,
  onSubmit,
  onCancel,
  catalogEntries,
  checkNameInCatalogIsUniq,
  labels,
}: TrainScheduleSetDialogProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formHasError, setFormHasError] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const submit = useCallback(
    async (data: TrainScheduleSetFormData) => {
      setLoading(true);
      try {
        await onSubmit(data);
        onCancel();
      } catch (e) {
        const errorMessage = getErrorMessage(e);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [onSubmit, onCancel]
  );

  return (
    <Dialog
      className="train-schedule-set-dialog"
      header={<h5>{labels.title}</h5>}
      footer={
        <>
          <div className="submit-error">
            {error && (
              <>
                <Blocked variant="fill" size="lg" />
                <span>{error}</span>
              </>
            )}
          </div>
          <div className="footer-buttons">
            <Button
              variant="Cancel"
              label={labels.cancel}
              onClick={onCancel}
              isDisabled={loading}
            />
            <Button
              label={
                labels.submitWithChanges && isEditing ? labels.submitWithChanges : labels.submit
              }
              form="train-schedule-set"
              type="submit"
              className={cx('submit-button', formHasError && 'wizz-effect')}
              onClick={noop}
              isLoading={loading}
            />
          </div>
        </>
      }
      footerClassname={cx('train-schedule-set-dialog-footer', error !== null && 'with-error')}
    >
      <TrainScheduleSetForm
        formId="train-schedule-set"
        trainScheduleSet={trainScheduleSet}
        catalogEntries={catalogEntries}
        onSubmit={submit}
        onValidation={(hasError) => setFormHasError(hasError)}
        checkNameInCatalogIsUniq={checkNameInCatalogIsUniq}
        setIsEditing={setIsEditing}
      />
    </Dialog>
  );
};

export default TrainScheduleSetDialog;
