import { useCallback, useMemo, useState } from 'react';

import {
  Button,
  DatePicker,
  Input,
  Select,
  Switch,
  TokenInput,
  type CalendarSlot,
} from '@osrd-project/ui-core';
import cx from 'classnames';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  LightRollingStockWithLiveries,
  PathfindingResult,
  TimetableType,
  TrainCategory,
} from 'common/api/osrdEditoastApi';
import type { Comfort, ConstraintDistribution } from 'common/api/osrdRailwayManagerApi';
import Banner from 'common/Banner';
import { useInfraID } from 'common/osrdContext';
import useSpeedLimitTags from 'common/SpeedLimitTagSelector/useSpeedLimitTags';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { checkCategoryWarning, findSubCategory } from 'modules/rollingStock/helpers/category';
import useCategoryOptions, {
  categoryOptionId,
} from 'modules/rollingStock/hooks/useCategoryOptions';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import { parseStartTime } from 'modules/trainSchedule/helpers/formatTrainScheduleWithDetails';
import {
  DEFAULT_PACED_TRAIN_INTERVAL,
  getDefaultPacedTrainTimeWindow,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { Train } from 'reducers/osrdconf/types';
import { Duration, type StartTime } from 'utils/duration';
import { usePrevious } from 'utils/hooks/state';
import { kmhToMs } from 'utils/physics';
import { isOccurrenceId, isTrainScheduleId } from 'utils/trainId';
import { createFixedSelectOptions, createStandardSelectOptions } from 'utils/uiCoreHelpers';

import RollingStockField from './RollingStockField';
import type { ExtraOccurrencesChanges } from './TrainHeader';
import TrainServiceForm, { computeServiceTimingError } from './TrainServiceForm';

// TODO: Passing `undefined` to DatePicker's selectableSlot prop should mean this
export const ANY_DATE_SLOT: CalendarSlot = { start: new Date(0), end: null };

export type ExpandedTrainFormProps = {
  train: Train;
  path?: Omit<PathfindingResult, 'status'>;
  onCollapse: () => void;
  onPersistTrain: (
    updatedTrain: Train,
    extraOccurrencesChanges?: ExtraOccurrencesChanges
  ) => Promise<void>;
  onItineraryOpened: () => void;
};

export type TrainFieldsState = {
  train_name: string;
  speed_limit_tag: string | null;
  constraint_distribution: ConstraintDistribution;
  comfort: Comfort | null;
  is_unique: boolean;
  category: TrainCategory | null;
  service_interval?: number;
  service_window?: number;
  use_electrical_profiles: boolean | null;
  labels: string[];
  added_exception_date: StartTime;
  rolling_stock: LightRollingStockWithLiveries | string;
  departure_date: StartTime;
  initial_speed: string | null;
  service_changed_confirmed: boolean;
};

export type InitialSpeedError = 'INVALID_NUMBER' | 'ROUNDING' | 'TOO_HIGH' | null;

function computeInitialSpeedError(
  initialSpeed: string | null,
  rollingStock?: LightRollingStockWithLiveries | string
): InitialSpeedError {
  if (!initialSpeed) return 'INVALID_NUMBER';
  const floatInitialSpeed = Number.parseFloat(initialSpeed);
  if (!isFinite(floatInitialSpeed) || floatInitialSpeed < 0) return 'INVALID_NUMBER';
  if (Math.round(floatInitialSpeed * 10) / 10 !== floatInitialSpeed) return 'ROUNDING';
  if (
    rollingStock &&
    typeof rollingStock !== 'string' &&
    kmhToMs(floatInitialSpeed) > rollingStock.max_speed
  )
    return 'TOO_HIGH';
  return null;
}

function getFieldsFromTrain(
  train: Train,
  rollingStocks: LightRollingStockWithLiveries[],
  timetableType: TimetableType
): TrainFieldsState {
  const rollingStock = rollingStocks.find((rs) => rs.name === train.rolling_stock_name);
  const startTime = parseStartTime(train.start_time, timetableType);

  return {
    train_name: train.train_name,
    speed_limit_tag: train.speed_limit_tag ?? null,
    constraint_distribution: train.constraint_distribution,
    comfort: train.comfort ?? null,
    category: train.category ?? null,
    is_unique: !train.paced,
    service_interval: train.paced ? Duration.parse(train.paced.interval).valueOf() : undefined,
    service_window: train.paced ? Duration.parse(train.paced.time_window).valueOf() : undefined,
    use_electrical_profiles: train?.options?.use_electrical_profiles ?? null,
    labels: train.labels ?? [],
    added_exception_date: startTime,
    rolling_stock: rollingStock ?? train.rolling_stock_name,
    departure_date: startTime,
    initial_speed:
      train.initial_speed === undefined ? null : String(Math.round(train.initial_speed * 36) / 10),
    service_changed_confirmed: !train.paced || train.paced.exceptions.length === 0,
  };
}

function applyFieldsToPaced(
  fields: TrainFieldsState,
  train: Train,
  timetableType: TimetableType
): Train['paced'] {
  if (fields.is_unique && !isOccurrenceId(train.id) && fields.service_changed_confirmed) {
    return undefined;
  }

  if (!fields.is_unique && !train.paced) {
    return {
      exceptions: [],
      interval: DEFAULT_PACED_TRAIN_INTERVAL.toISOString(),
      time_window: getDefaultPacedTrainTimeWindow(timetableType).toISOString(),
    };
  }

  if (
    fields.service_interval &&
    fields.service_window &&
    fields.service_interval > fields.service_window
  ) {
    return train.paced;
  }

  return train.paced
    ? {
        exceptions: train.paced.exceptions,
        interval:
          fields.service_changed_confirmed && !computeServiceTimingError(fields.service_interval)
            ? new Duration({ milliseconds: fields.service_interval }).toISOString()
            : train.paced.interval,
        time_window:
          fields.service_changed_confirmed && !computeServiceTimingError(fields.service_window)
            ? new Duration({ milliseconds: fields.service_window }).toISOString()
            : train.paced.time_window,
      }
    : undefined;
}

function applyFieldsToTrain(
  fields: TrainFieldsState,
  train: Train,
  timetableType: TimetableType
): Train {
  const rollingStock = typeof fields.rolling_stock === 'object' ? fields.rolling_stock : undefined;
  const customRollingStock = typeof fields.rolling_stock === 'string' ? fields.rolling_stock : '';

  const suggestedCategory =
    rollingStock && rollingStock.name !== train.rolling_stock_name && rollingStock.primary_category
      ? { main_category: rollingStock.primary_category }
      : undefined;

  return {
    ...train,
    train_name: fields.train_name || train.train_name,
    speed_limit_tag: fields.speed_limit_tag,
    constraint_distribution: fields.constraint_distribution,
    comfort: fields.comfort === null ? undefined : fields.comfort,
    category: fields.category === null ? suggestedCategory : fields.category,
    labels: fields.labels,
    paced: applyFieldsToPaced(fields, train, timetableType),
    rolling_stock_name: rollingStock ? rollingStock.name : customRollingStock,
    options: {
      ...train.options,
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

function trainPayloadChanged(updatedTrain: Train, train: Train): boolean {
  return (
    updatedTrain.paced?.interval !== train.paced?.interval ||
    updatedTrain.paced?.time_window !== train.paced?.time_window ||
    updatedTrain.train_name !== train.train_name ||
    (updatedTrain.speed_limit_tag ?? null) !== (train.speed_limit_tag ?? null) ||
    updatedTrain.constraint_distribution !== train.constraint_distribution ||
    updatedTrain.comfort !== train.comfort ||
    updatedTrain.rolling_stock_name !== train.rolling_stock_name ||
    updatedTrain.options?.use_electrical_profiles !== train.options?.use_electrical_profiles ||
    updatedTrain.start_time !== train.start_time ||
    updatedTrain.initial_speed !== train.initial_speed ||
    !isEqual(updatedTrain.category, train.category) ||
    !isEqual(updatedTrain.labels, train.labels)
  );
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
      !isEqual(after[fieldName], before[fieldName]) &&
      (!current || !isEqual(after[fieldName], current[fieldName]))
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
  path,
  onCollapse,
  onPersistTrain,
  onItineraryOpened,
}: ExpandedTrainFormProps) => {
  const { t } = useTranslation(['operational-studies', 'translation']);
  const infraID = useInfraID();
  const { scenario } = useScenarioContext();
  const timetableType = scenario.timetable_type;
  const speedLimitTags = useSpeedLimitTags(infraID);
  const categoryOptions = useCategoryOptions(false);

  const { filteredRollingStockList: rollingStocks } = useFilterRollingStock();

  const fieldsFromTrain = useMemo(
    () => getFieldsFromTrain(train, rollingStocks, timetableType),
    [train, rollingStocks, timetableType]
  );
  const [fields, setFields] = useState<TrainFieldsState>(fieldsFromTrain);

  // Reset fields values if they changed outside of the form (e.g., because it was an
  // exception and the user reverted it back to an occurrence through the train list)
  // NOTE: The setter is called outside a useEffect purposefully, as suggested in React's
  // documentation: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const originalFields = usePrevious(fieldsFromTrain);
  const previousPath = usePrevious(path);
  if (originalFields) {
    const changes = extractChangesInFields(originalFields, fieldsFromTrain, fields);

    if (Object.keys(changes).length) {
      setFields({ ...fields, ...changes });
    }
  }

  const [pathChanged, setPathChanged] = useState(false);
  if (!pathChanged && previousPath !== null && !isEqual(previousPath, path)) {
    setPathChanged(true);
  }

  const resetPathJustChanged = useCallback(() => {
    setPathChanged(false);
  }, [setPathChanged]);

  const persistTrainIfNeeded = useCallback(
    (newFields: TrainFieldsState) => {
      const updatedTrain = applyFieldsToTrain(newFields, train, timetableType);

      if (trainPayloadChanged(updatedTrain, train)) {
        onPersistTrain(updatedTrain);
      }
    },
    [train, onPersistTrain, timetableType]
  );

  const onFieldChange = useCallback(
    (fieldName: keyof TrainFieldsState, newValue: TrainFieldsState[typeof fieldName]) => {
      setFields({ ...fields, [fieldName]: newValue });
    },
    [fields]
  );

  const onFieldBlur = useCallback(
    (_fieldName: keyof TrainFieldsState) => {
      persistTrainIfNeeded(fields);
    },
    [fields, persistTrainIfNeeded]
  );

  const onFieldImmediateChange = useCallback(
    (fieldName: keyof TrainFieldsState, newValue: TrainFieldsState[typeof fieldName]) => {
      const newFields = { ...fields, [fieldName]: newValue };

      if (
        fieldName === 'service_interval' &&
        newFields.service_interval &&
        isTrainScheduleId(train.id) &&
        newFields.departure_date instanceof Duration &&
        newFields.departure_date.ms >= newFields.service_interval
      ) {
        // TODO: display warning
        newFields.departure_date = new Duration({
          milliseconds: newFields.departure_date.ms % newFields.service_interval,
        });
      }

      persistTrainIfNeeded(newFields);
      setFields(newFields);
    },
    [fields, persistTrainIfNeeded]
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
  const currentSubCategory = useMemo(
    () => findSubCategory(subCategories, fields.category),
    [fields.category, subCategories]
  );
  const isCategoryWarning = checkCategoryWarning(
    fields.rolling_stock,
    fields.category,
    currentSubCategory
  );
  const categoryWarning = isCategoryWarning
    ? t('manageTrainSchedule.trainHeader.categoryMismatch')
    : undefined;

  const initialSpeedError = useMemo(
    () => computeInitialSpeedError(fields.initial_speed, fields.rolling_stock),
    [fields.initial_speed, fields.rolling_stock, computeInitialSpeedError]
  );

  const revertServiceChange = useCallback(() => {
    setFields({
      ...fields,
      service_interval: fieldsFromTrain.service_interval,
      service_window: fieldsFromTrain.service_window,
      is_unique: fieldsFromTrain.is_unique,
    });
  }, [fields, fieldsFromTrain]);

  return (
    <div className="train-header expanded-train-form" data-testid="train-header-expanded">
      <TrainServiceForm
        train={train}
        fields={fields}
        fieldsFromTrain={fieldsFromTrain}
        initialSpeedError={initialSpeedError}
        onCollapse={onCollapse}
        onFieldChange={onFieldChange}
        onFieldImmediateChange={onFieldImmediateChange}
        onPersistTrain={onPersistTrain}
        revertServiceChange={revertServiceChange}
      />
      <div
        className={cx('train-form', {
          'calendar-timetable': timetableType === 'CALENDAR',
        })}
      >
        <div className="train-name" data-testid="train-name">
          <Input
            id="train-header-name-input"
            testIdPrefix="train-header-name"
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
        {fields.departure_date instanceof Date && (
          <div className="train-departure-date">
            <DatePicker
              testIdPrefix="train-header-departure-date"
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
        )}
        <div className="train-initial-velocity" data-testid="train-header-initial-velocity-field">
          <Input
            id="train-header-initial-velocity-input"
            testIdPrefix="train-header-initial-velocity"
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
            dataTestId="train-header-category-select"
            label={t('manageTrainSchedule.trainHeader.form.trainCategory')}
            small
            placeholder={t('translation:rollingStock.categoriesOptions.none')}
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
          <RollingStockField
            value={fields.rolling_stock}
            rollingStocks={rollingStocks}
            onFieldImmediateChange={onFieldImmediateChange}
          />
        </div>
        <div className="train-composition-code">
          <Select
            id="train-header-composition-code-select"
            dataTestId="train-header-composition-code-select"
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
            dataTestId="train-header-recovery-margin-select"
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
            dataTestId="train-header-comfort-select"
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
            dataTestId="train-header-electric-profile-checkbox"
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
            dataTestId="train-header-tags"
            label={t('manageTrainSchedule.trainHeader.form.tags')}
            tokens={fields.labels}
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
            dataTestID="train-header-itinerary-button"
          />
        </div>
      </div>
      {pathChanged && (
        <Banner
          message={t('manageTrainSchedule.trainHeader.pathChanged')}
          type="info"
          onClose={resetPathJustChanged}
          dataTestId="train-header-path-changed-banner"
        />
      )}
      {categoryWarning && (
        <Banner message={categoryWarning} dataTestId="train-header-category-warning-banner" />
      )}
    </div>
  );
};

export default ExpandedTrainForm;
