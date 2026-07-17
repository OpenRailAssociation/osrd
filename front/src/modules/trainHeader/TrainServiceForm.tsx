import { useCallback, useMemo, useState } from 'react';

import { Button, DurationInput, Switch } from '@osrd-project/ui-core';
import { ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { PacedTrain } from 'applications/operationalStudies/types';
import type { Train } from 'reducers/osrdconf/types';
import { MAX_DURATION_MS } from 'utils/duration';
import { findExceptionInPacedTrainByOccurrenceId } from 'utils/trainExceptions';
import { isOccurrenceId } from 'utils/trainId';

import type {
  ExpandedTrainFormProps,
  InitialSpeedError,
  TrainFieldsState,
} from './ExpandedTrainForm';
import ExtraOccurrenceForm from './ExtraOccurrenceForm';
import ExtraOccurrenceRow from './ExtraOccurrenceRow';
import { ServiceChangeWarningDialog } from './ServiceChangeWarningDialog';

export type ServiceTimingError = 'TOO_LOW' | 'TOO_HIGH' | null;

export function computeServiceTimingError(serviceTiming?: number): ServiceTimingError {
  if (!serviceTiming) return 'TOO_LOW';
  if (serviceTiming > MAX_DURATION_MS) return 'TOO_HIGH';
  return null;
}

type TrainServiceFormProps = {
  train: Train;
  fields: TrainFieldsState;
  fieldsFromTrain: TrainFieldsState;
  initialSpeedError: InitialSpeedError;
  onCollapse: ExpandedTrainFormProps['onCollapse'];
  onFieldChange: (
    fieldName: keyof TrainFieldsState,
    value: TrainFieldsState[typeof fieldName]
  ) => void;
  onFieldImmediateChange: (
    fieldName: keyof TrainFieldsState,
    value: TrainFieldsState[typeof fieldName]
  ) => void;
  onPersistTrain: ExpandedTrainFormProps['onPersistTrain'];
  revertServiceChange: () => void;
};

export default function TrainServiceForm({
  train,
  fields,
  fieldsFromTrain,
  initialSpeedError,
  onCollapse,
  onFieldChange,
  onFieldImmediateChange,
  onPersistTrain,
  revertServiceChange,
}: TrainServiceFormProps) {
  const { t } = useTranslation(['operational-studies', 'translation']);
  const [extraOccurrencesVisible, setExtraOccurrencesVisible] = useState(false);

  const pacedTrain = train.paced ? (train as PacedTrain) : null;
  const occurrenceId = isOccurrenceId(train.id) ? train.id : null;
  const exception =
    occurrenceId && pacedTrain
      ? findExceptionInPacedTrainByOccurrenceId(occurrenceId, pacedTrain)
      : null;
  const isPacedTrain = !!train.paced;
  const extraOccurrences =
    train.paced?.exceptions?.filter((exp) => exp.occurrence_index === undefined) ?? [];

  const serviceCadenceError = useMemo(
    () => (isPacedTrain ? computeServiceTimingError(fields.service_cadence) : null),
    [isPacedTrain, fields.service_cadence]
  );

  const serviceWindowError = useMemo(
    () => (isPacedTrain ? computeServiceTimingError(fields.service_window) : null),
    [isPacedTrain, fields.service_window]
  );

  const erroneousFields = useMemo(
    () =>
      !fields.train_name ||
      !fields.initial_speed ||
      !!initialSpeedError ||
      !!serviceCadenceError ||
      !!serviceWindowError,
    [
      fields.train_name,
      fields.initial_speed,
      initialSpeedError,
      serviceCadenceError,
      serviceWindowError,
    ]
  );

  const isServiceChangeWarningDialogVisible = useMemo(
    () =>
      !fields.service_changed_confirmed &&
      (fields.service_cadence?.valueOf() !== fieldsFromTrain.service_cadence?.valueOf() ||
        fields.service_window?.valueOf() !== fieldsFromTrain.service_window?.valueOf() ||
        fields.is_unique !== fieldsFromTrain.is_unique),
    [train.paced, fields, fieldsFromTrain]
  );

  const confirmServiceChange = useCallback(() => {
    onFieldImmediateChange('service_changed_confirmed', true);
  }, [onFieldImmediateChange]);

  return (
    <div className="train-service">
      <div className="toggle-band">
        <button className="header-toggle" onClick={() => onCollapse()} disabled={erroneousFields}>
          <ChevronUp />
        </button>
      </div>
      {occurrenceId ? (
        <div className="train-occurrence-tag">
          {t('manageTrainSchedule.trainHeader.serviceOccurrence')}
          {exception && ' ≠'}
        </div>
      ) : (
        <div className="train-service-form">
          <div className="train-schedule-kind">
            <Switch
              id="train-header-schedule-kind-toggle"
              checked={!fields.is_unique}
              label={t('manageTrainSchedule.trainHeader.serviceModelTrain')}
              size="sm"
              onChange={() => {
                onFieldImmediateChange('is_unique', !fields.is_unique);
              }}
            />
          </div>
          {isPacedTrain && (
            <>
              <div className="train-service-cadence">
                <DurationInput
                  id="train-header-service-cadence-input"
                  small
                  units={['m']}
                  padChar="0"
                  label={t('manageTrainSchedule.trainHeader.form.serviceCadence')}
                  value={fields.service_cadence ?? 1_800_000} // 30m
                  onChange={(ms) => onFieldImmediateChange('service_cadence', ms)}
                  statusWithMessage={
                    serviceCadenceError
                      ? {
                          status: 'error',
                          message:
                            serviceCadenceError === 'TOO_HIGH'
                              ? t('manageTrainSchedule.errorMessages.intervalTooHigh')
                              : t('manageTrainSchedule.errorMessages.intervalTooLow'),
                        }
                      : undefined
                  }
                />
              </div>
              <div className="train-service-window">
                <DurationInput
                  id="train-header-service-window-input"
                  small
                  units={['h', 'm']}
                  padChar="0"
                  label={t('manageTrainSchedule.trainHeader.form.serviceWindow')}
                  value={fields.service_window ?? 2 * 3_600_000} // 2h00m
                  onChange={(ms) => onFieldImmediateChange('service_window', ms)}
                  statusWithMessage={
                    serviceWindowError
                      ? {
                          status: 'error',
                          message:
                            serviceWindowError === 'TOO_HIGH'
                              ? t('manageTrainSchedule.errorMessages.timeWindowTooHigh')
                              : t('manageTrainSchedule.errorMessages.timeWindowTooLow'),
                        }
                      : undefined
                  }
                />
              </div>
              <div className="actions">
                <Button
                  label={t('manageTrainSchedule.trainHeader.form.extraOccurrences', {
                    count: extraOccurrences.length,
                  })}
                  variant="Quiet"
                  onClick={() => {
                    setExtraOccurrencesVisible(!extraOccurrencesVisible);
                  }}
                  size="small"
                />
              </div>
            </>
          )}
        </div>
      )}
      {isPacedTrain && extraOccurrencesVisible && (
        <div className="train-extra-occurrences">
          <ExtraOccurrenceForm
            addedExceptionDate={fields.added_exception_date}
            setAddedExceptionDate={(newAddedExceptionDate) =>
              onFieldChange('added_exception_date', newAddedExceptionDate)
            }
            onCreateAddedException={() => {
              onPersistTrain(train, {
                addedExceptions: [{ startTime: fields.added_exception_date }],
              });
            }}
          />
          <div className="train-extra-occurrences-list">
            {extraOccurrences
              .filter((occurrence) => occurrence.start_time?.value)
              .map((occurrence) => (
                <ExtraOccurrenceRow
                  key={`${occurrence.id}-${occurrence.key}`}
                  startTime={new Date(occurrence.start_time!.value)}
                  onDelete={() => {
                    // TODO_EXCEPTION: remove this when the exception migration will be done
                    if (occurrence.id !== null && occurrence.id !== undefined) {
                      onPersistTrain(train, { deletedAddedExceptionId: occurrence.id });
                    }
                  }}
                />
              ))}
          </div>
        </div>
      )}
      {isServiceChangeWarningDialogVisible && (
        <ServiceChangeWarningDialog
          exceptionsCount={train.paced!.exceptions.length}
          onCancel={revertServiceChange}
          onConfirm={confirmServiceChange}
        />
      )}
    </div>
  );
}
