import { useEffect, useMemo, useState } from 'react';

import {
  ComboBox,
  Input,
  Select,
  useDefaultComboBox,
  type StatusWithMessage,
} from '@osrd-project/ui-core';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { CategoryColors } from 'applications/operationalStudies/types';
import type {
  LightRollingStockWithLiveries,
  SubCategory,
  TrainCategory,
} from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import useSpeedLimitTags from 'common/SpeedLimitTagSelector/useSpeedLimitTags';
import useStoreDataForRollingStockSelector from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import isMainCategory from 'modules/rollingStock/helpers/category';
import useCategoryOptions from 'modules/rollingStock/hooks/useCategoryOptions';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import { updateCategory, updateName } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getName,
  getOperationalStudiesRollingStockID,
  getOperationalStudiesSpeedLimitByTag,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';
import { createStandardSelectOptions } from 'utils/uiCoreHelpers';

type ItineraryModalFormHeaderProps = {
  onCategoryWarningChange: (categoryWarning?: string) => void;
  category: TrainCategory | null;
  currentSubCategory?: SubCategory;
  categoryColors: CategoryColors;
  submitAttempted?: boolean;
  isNameEmpty?: boolean;
};

const ItineraryModalFormHeader = ({
  onCategoryWarningChange,
  category,
  currentSubCategory,
  categoryColors,
  submitAttempted,
  isNameEmpty,
}: ItineraryModalFormHeaderProps) => {
  const name = useSelector(getName);
  const dispatch = useAppDispatch();
  const { updateSpeedLimitByTag, updateRollingStockID } = useOsrdConfActions();

  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTimetableItem',
  });

  // Category
  const categoryOptions = useCategoryOptions();

  const handleCategoryChange = (option?: (typeof categoryOptions)[number]) => {
    if (option !== undefined) {
      dispatch(updateCategory(option.category));
    }
  };

  // RollingStock
  const rollingStockId = useSelector(getOperationalStudiesRollingStockID);
  const { rollingStock } = useStoreDataForRollingStockSelector({
    rollingStockId,
  });
  const getRollingStockLabel = (rs: LightRollingStockWithLiveries) => {
    const secondPart = rs.metadata?.series || rs.metadata?.reference || '';
    return secondPart ? `${rs.name} - ${secondPart}` : rs.name;
  };

  const { filteredRollingStockList } = useFilterRollingStock();

  const rollingStockComboBoxDefaultProps = useDefaultComboBox(
    filteredRollingStockList,
    getRollingStockLabel
  );

  const handleRollingStockSelect = (rs?: LightRollingStockWithLiveries) => {
    if (!rs) {
      dispatch(updateRollingStockID(undefined));
      dispatch(updateCategory(null));
      return;
    }

    dispatch(updateRollingStockID(rs.id));
    dispatch(updateCategory(rs.primary_category ? { main_category: rs.primary_category } : null));
  };

  // Composition code/speed limit by tag
  const speedLimitByTag = useSelector(getOperationalStudiesSpeedLimitByTag);
  const speedLimitTags = useSpeedLimitTags();

  // Timetable item name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateName(e.target.value));
  };
  // Timetable item name error
  const [isNameBlurred, setIsNameBlurred] = useState(false);

  const nameError: StatusWithMessage | undefined = useMemo(() => {
    const shouldShowError = (isNameBlurred || (submitAttempted && isNameBlurred)) && isNameEmpty;
    if (!shouldShowError) return undefined;

    return {
      status: 'error',
      message: t('errorMessages.requiredField'),
    };
  }, [isNameBlurred, submitAttempted, isNameEmpty, t]);

  // Category warning
  const categoryWarningMessage = useMemo(() => {
    if (!rollingStock || !category) return undefined;

    const isMismatch = isMainCategory(category)
      ? category.main_category !== rollingStock.primary_category &&
        !rollingStock.other_categories.includes(category.main_category)
      : currentSubCategory?.main_category !== rollingStock.primary_category;

    return isMismatch ? t('categoryMismatch') : undefined;
  }, [rollingStock, category, currentSubCategory, t]);

  useEffect(() => {
    onCategoryWarningChange(categoryWarningMessage);
  }, [categoryWarningMessage]);

  return (
    <>
      <div className="category-row">
        <div
          className="category-color"
          style={{
            backgroundColor: categoryColors.normal,
          }}
        />
        <div className="category-select">
          <Select
            id="itinerary-modal-category"
            narrow
            small
            options={categoryOptions}
            value={categoryOptions.find((option) => isEqual(option.category, category))}
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.id}
            onChange={handleCategoryChange}
          ></Select>
        </div>
      </div>
      <div className="rolling-stock-cc-name-row">
        <div className="rolling-stock-combobox">
          <ComboBox
            id="itinerary-modal-rolling-stock"
            label={t('rollingstock')}
            narrow
            small
            autoComplete="off"
            value={rollingStock}
            getSuggestionLabel={getRollingStockLabel}
            onSelectSuggestion={handleRollingStockSelect}
            {...rollingStockComboBoxDefaultProps}
          />
        </div>
        <div className="composition-code-select">
          <Select
            id="itinerary-modal-composition-code"
            label={t('speedLimitByTagAbbrev')}
            narrow
            small
            placeholder={t('noSpeedLimitByTag')}
            value={speedLimitByTag || ''}
            {...createStandardSelectOptions(speedLimitTags)}
            onChange={(e) => {
              dispatch(updateSpeedLimitByTag(e ?? null));
            }}
          ></Select>
        </div>
        <div className="train-name-input">
          <Input
            narrow
            small
            id="itinerary-modal-timetable-item-name"
            label={t('itineraryModal.trainName')}
            value={name}
            title={name}
            onChange={handleNameChange}
            onBlur={() => {
              setIsNameBlurred(true);
            }}
            onFocus={() => {
              setIsNameBlurred(false);
            }}
            statusWithMessage={nameError}
          />
        </div>
      </div>
    </>
  );
};

export default ItineraryModalFormHeader;
