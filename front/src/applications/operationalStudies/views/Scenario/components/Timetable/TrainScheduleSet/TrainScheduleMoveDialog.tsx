import { useCallback, useState } from 'react';

import { Button, Dialog } from '@osrd-project/ui-core';
import { Blocked } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { noop } from 'lodash';

import type { CatalogEntry, TrainScheduleSet } from 'common/api/osrdEditoastApi';
import { getErrorMessage } from 'utils/error';

import TrainScheduleSetSelect from './TrainScheduleSetSelect';

type TrainScheduleMoveDialogProps = {
  trainScheduleSets: TrainScheduleSet[];
  setTrainScheduleSetIdSelected: (id: number | undefined) => void;
  trainScheduleSetIdSelected?: number;
  onCancel: () => void;
  onSubmit: (ttsid: number) => Promise<void>;
  catalogEntries: CatalogEntry[];
  labels: {
    title: string;
    submit: string;
    cancel: string;
  };
};

const TrainScheduleMoveDialog = ({
  trainScheduleSets,
  setTrainScheduleSetIdSelected,
  trainScheduleSetIdSelected,
  onSubmit,
  onCancel,
  catalogEntries,
  labels,
}: TrainScheduleMoveDialogProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (ttsid: number) => {
      setLoading(true);
      try {
        await onSubmit(ttsid);
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
      className={cx('train-schedule-set-dialog', { 'with-error': error !== null })}
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
              form="train-schedule-set"
              type="submit"
              className={cx('submit-button')}
              onClick={noop}
              isLoading={loading}
              isDisabled={!trainScheduleSetIdSelected}
            />
          </div>
        </>
      }
    >
      <TrainScheduleSetSelect
        formId="train-schedule-set"
        trainScheduleSets={trainScheduleSets}
        setTrainScheduleSetIdSelected={setTrainScheduleSetIdSelected}
        trainScheduleSetIdSelected={trainScheduleSetIdSelected}
        catalogEntries={catalogEntries}
        onSubmit={submit}
      />
    </Dialog>
  );
};

export default TrainScheduleMoveDialog;
