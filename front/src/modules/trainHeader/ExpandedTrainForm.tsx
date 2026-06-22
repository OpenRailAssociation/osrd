import { useCallback, useMemo, useState } from 'react';

import {
  Button,
  ComboBox,
  DatePicker,
  DurationInput,
  Input,
  Select,
  Switch,
  TokenInput,
  useDefaultComboBox,
  type CalendarSlot,
} from '@osrd-project/ui-core';
import { ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { PacedTrainWithPaced } from 'applications/operationalStudies/types';
import type { LightRollingStockWithLiveries, TrainCategory } from 'common/api/osrdEditoastApi';
import type { Comfort, ConstraintDistribution } from 'common/api/osrdRailwayManagerApi';
import Banner from 'common/Banner';
import useSpeedLimitTags from 'common/SpeedLimitTagSelector/useSpeedLimitTags';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import isMainCategory, { checkCategoryWarning } from 'modules/rollingStock/helpers/category';
import useCategoryOptions, {
  categoryOptionId,
} from 'modules/rollingStock/hooks/useCategoryOptions';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import type { Train } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { usePrevious } from 'utils/hooks/state';
import { findExceptionInPacedTrainByOccurenceId } from 'utils/trainExceptions';
import { isOccurrenceId } from 'utils/trainId';
import { createFixedSelectOptions, createStandardSelectOptions } from 'utils/uiCoreHelpers';

import ExtraOccurrenceForm from './ExtraOccurrenceForm';
import ExtraOccurrenceRow from './ExtraOccurrenceRow';
import { ServiceChangeWarningDialog } from './ServiceChangeWarningDialog';
import type { ExtraOccurrencesChanges } from './TrainHeader';

// TODO: Passing `undefined` to DatePicker's selectableSlot prop should mean this
export const ANY_DATE_SLOT: CalendarSlot = { start: new Date(0), end: null };

export type ExpandedTrainFormProps = {
  train: Train;
  onCollapse: () => void;
  onPersistTrain: (
    updatedTrain: Train,
    extraOccurrencesChanges?: ExtraOccurrencesChanges
  ) => Promise<void>;
  onItineraryOpened: () => void;
};

type TrainFieldsState = {
  train_name: string;
  speed_limit_tag: string | null;
  constraint_distribution: ConstraintDistribution;
  comfort: Comfort | null;
  category: TrainCategory | null;
  service_cadence?: number;
  service_window?: number;
  use_electrical_profiles: boolean | null;
  labels: string[];
  added_exception_date: Date;
  rolling_stock_name: string;
  departure_date: Date;
  initial_speed: string | null;
  service_changed_confirmed: boolean;
};

type initialSpeedProblem = 'INVALID_NUMBER' | 'ROUNDING' | 'TOO_HIGH' | null;

function computeInitialSpeedError(
  initialSpeed: string | null,
  rollingStock?: LightRollingStockWithLiveries
): initialSpeedProblem {
  if (!initialSpeed) return 'INVALID_NUMBER';
  const floatInitialSpeed = Number.parseFloat(initialSpeed);
  if (!isFinite(floatInitialSpeed) || floatInitialSpeed < 0) return 'INVALID_NUMBER';
  if (Math.round(floatInitialSpeed * 10) / 10 !== floatInitialSpeed) return 'ROUNDING';
  if (rollingStock && floatInitialSpeed > rollingStock?.max_speed) return 'TOO_HIGH';
  return null;
}

function getFieldsFromTrain(train: Train): TrainFieldsState {
  return {
    train_name: train.train_name,
    speed_limit_tag: train.speed_limit_tag ?? null,
    constraint_distribution: train.constraint_distribution,
    comfort: train.comfort ?? null,
    category: train.category ?? null,
    service_cadence: train.paced ? Duration.parse(train.paced.interval).valueOf() : undefined,
    service_window: train.paced ? Duration.parse(train.paced.time_window).valueOf() : undefined,
    use_electrical_profiles: train?.options?.use_electrical_profiles ?? null,
    labels: train.labels ?? [],
    added_exception_date: new Date(train.start_time),
    rolling_stock_name: train.rolling_stock_name,
    departure_date: new Date(train.start_time),
    initial_speed:
      train.initial_speed === undefined ? null : String(Math.round(train.initial_speed * 36) / 10),
    service_changed_confirmed: !train.paced || train.paced.exceptions.length === 0,
  };
}

function applyFieldsToTrain(
  fields: TrainFieldsState,
  train: Train,
  rollingStock?: LightRollingStockWithLiveries
): Train {
  const paced = train.paced
    ? {
        exceptions: train.paced.exceptions,
        interval: fields.service_changed_confirmed
          ? new Duration({ milliseconds: fields.service_cadence }).toISOString()
          : train.paced.interval,
        time_window: fields.service_changed_confirmed
          ? new Duration({ milliseconds: fields.service_window }).toISOString()
          : train.paced.time_window,
      }
    : undefined;

  return {
    ...train,
    train_name: fields.train_name || train.train_name,
    speed_limit_tag: fields.speed_limit_tag,
    constraint_distribution: fields.constraint_distribution,
    comfort: fields.comfort === null ? undefined : fields.comfort,
    category: fields.category === null ? undefined : fields.category,
    labels: fields.labels,
    rolling_stock_name: fields.rolling_stock_name,
    paced,
    options: {
      use_electrical_profiles:
        fields?.use_electrical_profiles === null ? undefined : fields.use_electrical_profiles,
    },
    start_time: fields.departure_date.valueOf(),
    initial_speed:
      fields.initial_speed === null || computeInitialSpeedError(fields.initial_speed, rollingStock)
        ? train.initial_speed
        : Number.parseFloat(fields.initial_speed) / 3.6,
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
  const speedLimitTags = useSpeedLimitTags();
  const categoryOptions = useCategoryOptions();

  const { filteredRollingStockList: rollingStocks } = useFilterRollingStock();

  const getRollingStockLabel = (rs: LightRollingStockWithLiveries) => {
    const secondPart = rs.metadata?.series || rs.metadata?.reference || '';
    return secondPart ? `${rs.name} - ${secondPart}` : rs.name;
  };

  const {
    suggestions: rollingStockSuggestions,
    onChange: onRollingStockQueryChange,
    resetSuggestions: resetRollingStockSuggestions,
  } = useDefaultComboBox(rollingStocks, getRollingStockLabel);

  const pacedTrain = train.paced ? (train as PacedTrainWithPaced) : null;
  const occurenceId = isOccurrenceId(train.id) ? train.id : null;
  const exception =
    occurenceId && pacedTrain
      ? findExceptionInPacedTrainByOccurenceId(occurenceId, pacedTrain)
      : null;

  const fieldsFromTrain = useMemo(() => getFieldsFromTrain(train), [train]);
  const [fields, setFields] = useState<TrainFieldsState>(fieldsFromTrain);
  const [extraOccurrencesVisible, setExtraOccurrencesVisible] = useState(false);
  const extraOccurrences =
    train.paced?.exceptions?.filter((exp) => exp.occurrence_index === undefined) ?? [];

  const selectedRollingStock = useMemo(
    () => rollingStocks.find((rs) => rs.name === fields.rolling_stock_name),
    [fields.rolling_stock_name, rollingStocks]
  );

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
        const updatedTrain = applyFieldsToTrain(fields, train, selectedRollingStock);
        onPersistTrain(updatedTrain);
      }
    },
    [train, fields, fieldsFromTrain, onPersistTrain]
  );

  const onFieldImmediateChange = useCallback(
    (fieldName: keyof TrainFieldsState, newValue: TrainFieldsState[typeof fieldName]) => {
      const newFields = { ...fields, [fieldName]: newValue };
      const updatedTrain = applyFieldsToTrain(newFields, train, selectedRollingStock);
      onPersistTrain(updatedTrain);

      setFields(newFields);
    },
    [fields, train, onPersistTrain]
  );

  const constraintDistributionsOptions: { id: ConstraintDistribution; label: string }[] = useMemo(
    () => [
      {
        id: 'STANDARD',
        label: t('manageTrainSchedule.allowances.distribution-linear'),
      },
      {
        id: 'MARECO',
        label: t('manageTrainSchedule.allowances.distribution-mareco'),
      },
    ],
    [t]
  );
  const selectedConstraintDistributionOption = useMemo(
    () =>
      constraintDistributionsOptions.find(
        (constraint) => constraint.id === fields.constraint_distribution
      ),
    [fields.constraint_distribution, constraintDistributionsOptions]
  );

  const comfortOptions: { id: Comfort; label: string }[] = useMemo(
    () => [
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
    ],
    [t]
  );
  const selectedComfortOption = useMemo(
    () => comfortOptions.find((comfort) => comfort.id === fields.comfort),
    [comfortOptions, fields.comfort]
  );
  const selectedCategoryId = useMemo(
    () => (fields.category ? categoryOptionId(fields.category) : null),
    [fields.category]
  );
  const selectedCategoryOption = useMemo(
    () => categoryOptions.find((category) => category.id === selectedCategoryId),
    [categoryOptions, selectedCategoryId]
  );

  const subCategories = useSubCategoryContext();
  const currentSubCategory = useMemo(() => {
    const category = fields.category;
    if (!category || isMainCategory(category)) return undefined;
    return subCategories.find((option) => option.code === category.sub_category_code);
  }, [fields.category, subCategories]);
  const isCategoryWarning = checkCategoryWarning(
    selectedRollingStock,
    fields.category,
    currentSubCategory
  );
  const categoryWarning = isCategoryWarning
    ? t('manageTrainSchedule.trainHeader.categoryMismatch')
    : undefined;

  const initialSpeedError = useMemo(
    () => computeInitialSpeedError(fields.initial_speed, selectedRollingStock),
    [fields.initial_speed, selectedRollingStock, computeInitialSpeedError]
  );

  const erroneousFields = useMemo(
    () => !fields.train_name || !fields.initial_speed || !!initialSpeedError,
    [fields.train_name, fields.initial_speed, initialSpeedError]
  );

  const toggleBand = (
    <div className="toggle-band">
      <button className="header-toggle" onClick={() => onCollapse()} disabled={erroneousFields}>
        <ChevronUp />
      </button>
    </div>
  );

  const isServiceChangeWarningDialogVisible = useMemo(
    () =>
      !fields.service_changed_confirmed &&
      (fields.service_cadence?.valueOf() !== fieldsFromTrain.service_cadence?.valueOf() ||
        fields.service_window?.valueOf() !== fieldsFromTrain.service_window?.valueOf()),
    [train.paced, fields, fieldsFromTrain]
  );

  const revertServiceChange = useCallback(() => {
    setFields({
      ...fields,
      service_cadence: fieldsFromTrain.service_cadence,
      service_window: fieldsFromTrain.service_window,
    });
  }, [fields, fieldsFromTrain]);

  const confirmServiceChange = useCallback(() => {
    onFieldImmediateChange('service_changed_confirmed', true);
  }, [onFieldImmediateChange]);

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
            <>
              <div className="train-service-form">
                <div className="train-paced-kind">
                  {t('manageTrainSchedule.trainHeader.serviceModelTrain')}
                </div>
                <div className="train-service-cadence">
                  <DurationInput
                    id="train-header-service-cadence-input"
                    small
                    units={['m']}
                    padChar="0"
                    max={3_600_000}
                    label={t('manageTrainSchedule.trainHeader.form.serviceCadence')}
                    value={fields.service_cadence ?? 0}
                    onChange={(ms) => onFieldImmediateChange('service_cadence', ms)}
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
              </div>

              {extraOccurrencesVisible && (
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
            </>
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
            statusWithMessage={
              !fields.train_name
                ? {
                    status: 'error',
                    message: t('manageTrainSchedule.errorMessages.requiredField'),
                  }
                : undefined
            }
          />
        </div>
        <div className="train-departure-date">
          <DatePicker
            value={fields.departure_date}
            isRangeMode={false}
            inputProps={{
              id: 'train-header-departure-date-input',
              label: t('manageTrainSchedule.trainHeader.form.departureDate'),
              small: true,
            }}
            onDateChange={(departureDate) => {
              if (!departureDate) return;
              const startTimeDate = new Date(train.start_time);
              departureDate?.setHours(
                startTimeDate.getHours(),
                startTimeDate.getMinutes(),
                startTimeDate.getSeconds()
              );
              onFieldImmediateChange('departure_date', departureDate);
            }}
            selectableSlot={ANY_DATE_SLOT}
          />
        </div>
        <div className="train-initial-velocity">
          <Input
            id="train-header-initial-velocity-input"
            small
            label={t('manageTrainSchedule.trainHeader.form.initialVelocity')}
            value={fields.initial_speed ?? '0'}
            trailingContent={'km/h'}
            onChange={(event) => {
              onFieldChange('initial_speed', event.target.value);
            }}
            onBlur={() => onFieldBlur('initial_speed')}
            statusWithMessage={(() => {
              switch (initialSpeedError) {
                case 'INVALID_NUMBER':
                  return {
                    status: 'error',
                    message: t('manageTrainSchedule.trainHeader.form.invalidInitialSpeed'),
                  };
                case 'ROUNDING':
                  return {
                    status: 'error',
                    message: t('manageTrainSchedule.trainHeader.form.invalidInitialSpeedRounding'),
                  };
                case 'TOO_HIGH':
                  return {
                    status: 'error',
                    message: t('manageTrainSchedule.trainHeader.form.initialSpeedTooHigh'),
                  };
                default:
                  return undefined;
              }
            })()}
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
          <ComboBox
            id="train-header-rolling-stock-input"
            label={t('manageTrainSchedule.trainHeader.form.rollingStock')}
            small
            autoComplete="off"
            value={
              selectedRollingStock
                ? getRollingStockLabel(selectedRollingStock)
                : fields.rolling_stock_name
            }
            suggestions={rollingStockSuggestions.map(getRollingStockLabel)}
            getSuggestionLabel={(s) => s}
            onSelectSuggestion={(label) => {
              const rs = rollingStocks.find((r) => getRollingStockLabel(r) === label);
              if (rs) onFieldImmediateChange('rolling_stock_name', rs.name);
            }}
            resetSuggestions={resetRollingStockSuggestions}
            onChange={(e) => {
              onRollingStockQueryChange(e);
              onFieldChange('rolling_stock_name', e.target.value);
            }}
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
          <Switch
            id="train-header-electric-profile-input"
            checked={fields.use_electrical_profiles ?? false}
            label={t('manageTrainSchedule.trainHeader.form.electricalProfiles')}
            onChange={(event) => {
              onFieldImmediateChange('use_electrical_profiles', event.target.checked);
            }}
          />
        </div>
        <div className="train-tags">
          <TokenInput
            small
            label={t('manageTrainSchedule.trainHeader.form.tags')}
            tokens={train?.labels ?? []}
            onChange={(tokens) => {
              onFieldImmediateChange('labels', tokens);
            }}
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
      {categoryWarning && <Banner message={categoryWarning} />}
      {isServiceChangeWarningDialogVisible && (
        <ServiceChangeWarningDialog
          exceptionsCount={train.paced!.exceptions.length}
          onCancel={revertServiceChange}
          onConfirm={confirmServiceChange}
        />
      )}
    </div>
  );
};

export default ExpandedTrainForm;
