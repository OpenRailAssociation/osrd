import { useCallback, useMemo, useState } from 'react';

import { Button, Checkbox, Input, Select } from '@osrd-project/ui-core';
import { ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { PacedTrainWithPaced } from 'applications/operationalStudies/types';
import type { TrainCategory } from 'common/api/osrdEditoastApi';
import type { Comfort, ConstraintDistribution } from 'common/api/osrdRailwayManagerApi';
import useSpeedLimitTags from 'common/SpeedLimitTagSelector/useSpeedLimitTags';
import useCategoryOptions, {
  categoryOptionId,
} from 'modules/rollingStock/hooks/useCategoryOptions';
import type { Train } from 'reducers/osrdconf/types';
import { useDateTimeLocale } from 'utils/date';
import { usePrevious } from 'utils/hooks/state';
import { findExceptionInPacedTrainByOccurenceId } from 'utils/trainExceptions';
import { isOccurrenceId } from 'utils/trainId';
import { createFixedSelectOptions, createStandardSelectOptions } from 'utils/uiCoreHelpers';

import {
  getServiceInterval,
  getServiceWindow,
  getShortDepartureDate,
} from './utils/trainProperties';

export type ExpandedTrainFormProps = {
  train: Train;
  onCollapse: () => void;
  onPersistTrain: (updatedTrain: Train, addedExceptions?: { startTime: Date }[]) => Promise<void>;
  onItineraryOpened: () => void;
};

type TrainFieldsState = {
  train_name: string;
  speed_limit_tag: string | null;
  constraint_distribution: ConstraintDistribution;
  comfort: Comfort | null;
  category: TrainCategory | null;
};

function getFieldsFromTrain(train: Train): TrainFieldsState {
  return {
    train_name: train.train_name,
    speed_limit_tag: train.speed_limit_tag ?? null,
    constraint_distribution: train.constraint_distribution,
    comfort: train.comfort ?? null,
    category: train.category ?? null,
  };
}

function applyFieldsToTrain(fields: TrainFieldsState, train: Train): Train {
  return {
    ...train,
    ...fields,
    comfort: fields.comfort === null ? undefined : fields.comfort,
    category: fields.category === null ? undefined : fields.category,
  };
}

function registerChange<K extends keyof TrainFieldsState>(
  changedValues: Partial<TrainFieldsState>,
  changedKey: K,
  newValue: TrainFieldsState[K]
) {
  changedValues[changedKey] = newValue;
}

function extractChangesInFields(
  before: TrainFieldsState,
  after: TrainFieldsState,
  current?: TrainFieldsState
): Partial<TrainFieldsState> {
  const changedValues: Partial<TrainFieldsState> = {};

  for (const fieldName of Object.keys(before) as (keyof TrainFieldsState)[]) {
    if (
      after[fieldName] !== before[fieldName] &&
      (!current || after[fieldName] !== current[fieldName])
    ) {
      registerChange(changedValues, fieldName, after[fieldName]);
    }
  }
  return changedValues;
}

/**
 * A header-shaped form that allow users to set most of the properties of a train, beside the itinerary itself.
 */
const ExpandedTrainForm = ({
  train,
  onCollapse,
  onPersistTrain,
  onItineraryOpened,
}: ExpandedTrainFormProps) => {
  const { t } = useTranslation(['operational-studies', 'translation']);
  const dateTimeLocale = useDateTimeLocale();
  const speedLimitTags = useSpeedLimitTags();
  const categoryOptions = useCategoryOptions();

  const pacedTrain = train.paced ? (train as PacedTrainWithPaced) : null;
  const occurenceId = isOccurrenceId(train.id) ? train.id : null;
  const exception =
    occurenceId && pacedTrain
      ? findExceptionInPacedTrainByOccurenceId(occurenceId, pacedTrain)
      : null;

  const fieldsFromTrain = useMemo(() => getFieldsFromTrain(train), [train]);
  const [fields, setFields] = useState<TrainFieldsState>(fieldsFromTrain);

  // Reset fields values if they changed outside of the form (e.g., because it was an
  // exception and the user reverted it back to an occurence through the train list)
  // NOTE: The setter is called outside a useEffect purposefully, as suggested in React's
  // documentation: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const originalFields = usePrevious(fieldsFromTrain);
  if (originalFields) {
    const changes = extractChangesInFields(originalFields, fieldsFromTrain, fields);

    if (Object.keys(changes).length) {
      setFields({ ...fields, ...changes });
    }
  }

  const onFieldChange = useCallback(
    (fieldName: keyof TrainFieldsState, newValue: TrainFieldsState[typeof fieldName]) => {
      setFields({ ...fields, [fieldName]: newValue });
    },
    [fields]
  );

  const onFieldBlur = useCallback(
    (_fieldName: keyof TrainFieldsState) => {
      const changes = extractChangesInFields(fieldsFromTrain, fields);

      if (Object.keys(changes).length) {
        const updatedTrain = applyFieldsToTrain(fields, train);
        onPersistTrain(updatedTrain);
      }
    },
    [fields, fieldsFromTrain]
  );

  const onFieldImmediateChange = useCallback(
    (fieldName: keyof TrainFieldsState, newValue: TrainFieldsState[typeof fieldName]) => {
      const newFields = { ...fields, [fieldName]: newValue };
      const updatedTrain = applyFieldsToTrain(newFields, train);
      onPersistTrain(updatedTrain);

      setFields(newFields);
    },
    [fields]
  );

  const constraintDistributionsOptions: { id: ConstraintDistribution; label: string }[] = [
    {
      id: 'STANDARD',
      label: t('manageTrainSchedule.allowances.distribution-linear'),
    },
    {
      id: 'MARECO',
      label: t('manageTrainSchedule.allowances.distribution-mareco'),
    },
  ];
  const selectedConstraintDistributionOption = useMemo(
    () =>
      constraintDistributionsOptions.find(
        (constraint) => constraint.id === fields.constraint_distribution
      ),
    [fields.constraint_distribution]
  );

  const comfortOptions: { id: Comfort; label: string }[] = [
    {
      id: 'STANDARD',
      label: t('translation:rollingStock.comfortTypes.STANDARD'),
    },
    {
      id: 'AIR_CONDITIONING',
      label: t('translation:rollingStock.comfortTypes.AIR_CONDITIONING'),
    },
    {
      id: 'HEATING',
      label: t('translation:rollingStock.comfortTypes.HEATING'),
    },
  ];
  const selectedComfortOption = useMemo(
    () => comfortOptions.find((comfort) => comfort.id === fields.comfort),
    [fields.comfort]
  );

  const selectedCategoryId = useMemo(
    () => (fields.category ? categoryOptionId(fields.category) : null),
    [fields.category]
  );
  const selectedCategoryOption = useMemo(
    () => categoryOptions.find((category) => category.id === selectedCategoryId),
    [selectedCategoryId]
  );

  const toggleBand = (
    <div className="toggle-band">
      <button className="header-toggle" onClick={() => onCollapse()}>
        <ChevronUp />
      </button>
    </div>
  );

  return (
    <div className="train-header expanded-train-form">
      {pacedTrain && (
        <div className="train-service">
          {toggleBand}
          {occurenceId ? (
            <div className="train-occurrence">
              <div className="train-paced-kind">
                {t('manageTrainSchedule.trainHeader.serviceOccurrence')}
                {exception && ' ≠'}
              </div>
            </div>
          ) : (
            <div className="train-service-form">
              <div className="train-paced-kind">
                {t('manageTrainSchedule.trainHeader.serviceModelTrain')}
              </div>
              <div className="train-service-cadence">
                <Input
                  id="train-header-service-cadence-input"
                  small
                  label={t('manageTrainSchedule.trainHeader.form.serviceCadence')}
                  value={`${getServiceInterval(pacedTrain) ?? 0} min`}
                  disabled
                />
              </div>
              <div className="train-service-window">
                <Input
                  id="train-header-service-window-input"
                  small
                  label={t('manageTrainSchedule.trainHeader.form.serviceWindow')}
                  value={`${getServiceWindow(pacedTrain) ?? 0} min`}
                  disabled
                />
              </div>
              <div className="actions">
                <Button
                  label={t('manageTrainSchedule.trainHeader.form.extraOccurrences', {
                    count: 0 /* TODO: properly compute the number of extra occurrences */,
                  })}
                  variant="Quiet"
                  onClick={() => {}}
                  size="small"
                  isDisabled
                />
              </div>
            </div>
          )}
        </div>
      )}
      {!pacedTrain && toggleBand}
      <div className="train-form">
        <div className="train-name">
          <Input
            id="train-header-name-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.trainName')}
            value={fields.train_name}
            onChange={(event) => onFieldChange('train_name', event.target.value)}
            onBlur={() => onFieldBlur('train_name')}
          />
        </div>
        <div className="train-departure-date">
          <Input
            id="train-header-departure-date-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.departureDate')}
            value={getShortDepartureDate(train, dateTimeLocale) ?? ''}
            disabled
          />
        </div>
        <div className="train-initial-velocity">
          <Input
            id="train-header-initial-velocity-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.initialVelocity')}
            value={train.initial_speed ?? ''}
            disabled
          />
        </div>
        <div className="train-category">
          <Select
            id="train-header-category-select"
            label={t('manageTrainSchedule.trainHeader.form.trainCategory')}
            small
            value={selectedCategoryOption}
            options={categoryOptions}
            getOptionLabel={(option) => option?.label ?? ''}
            getOptionValue={(option) => option?.id ?? ''}
            onChange={(value) => {
              onFieldImmediateChange('category', value?.category ?? null);
            }}
          />
        </div>
        <div className="train-rolling-stock">
          <Input
            id="train-header-rolling-stock-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.rollingStock')}
            value={train.rolling_stock_name ?? ''}
            disabled
          />
        </div>
        <div className="train-composition-code">
          <Select
            id="train-header-composition-code-select"
            label={t('manageTrainSchedule.trainHeader.form.compositionCode')}
            small
            placeholder={t('manageTrainSchedule.noSpeedLimitByTag')}
            value={fields.speed_limit_tag ?? ''}
            {...createStandardSelectOptions(speedLimitTags)}
            onChange={(value) => {
              onFieldImmediateChange('speed_limit_tag', value ?? null);
            }}
          />
        </div>
        <div className="train-recovery-margin">
          <Select
            id="train-header-recovery-margin-select"
            label={t('manageTrainSchedule.trainHeader.form.recoveryMargin')}
            small
            value={selectedConstraintDistributionOption}
            {...createFixedSelectOptions(constraintDistributionsOptions)}
            onChange={(value) => {
              if (value) {
                onFieldImmediateChange('constraint_distribution', value.id);
              }
            }}
          />
        </div>
        <div className="train-comfort">
          <Select
            id="train-header-comfort-select"
            label={t('manageTrainSchedule.trainHeader.form.comfort')}
            small
            value={selectedComfortOption}
            {...createFixedSelectOptions(comfortOptions)}
            onChange={(value) => {
              onFieldImmediateChange('comfort', value?.id ?? null);
            }}
          />
        </div>
        <div className="train-electric-profile loose-field">
          <Checkbox
            id="train-header-electric-profile-input"
            checked={train?.options?.use_electrical_profiles}
            disabled
          >
            {t('manageTrainSchedule.trainHeader.form.electricalProfiles')}
          </Checkbox>
        </div>
        <div className="train-tags">
          <Input
            id="train-header-tags-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.tags')}
            value={train?.labels?.join(', ') ?? ''}
            disabled
          />
        </div>

        <div className="actions">
          <Button
            label={t('manageTrainSchedule.trainHeader.itinerary')}
            variant="Quiet"
            onClick={onItineraryOpened}
            size="small"
          />
        </div>
      </div>
    </div>
  );
};

export default ExpandedTrainForm;
