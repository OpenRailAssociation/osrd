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

import type { CategoryColors } from 'applications/operationalStudies/types';
import type { LightRollingStockWithLiveries, SubCategory } from 'common/api/osrdEditoastApi';
import useSpeedLimitTags from 'common/SpeedLimitTagSelector/useSpeedLimitTags';
import useStoreDataForRollingStockSelector from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import isMainCategory from 'modules/rollingStock/helpers/category';
import useCategoryOptions from 'modules/rollingStock/hooks/useCategoryOptions';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import { createStandardSelectOptions } from 'utils/uiCoreHelpers';

import type { ItineraryModalFormState } from './ItineraryModal';

type ItineraryModalFormHeaderProps = {
  modalFormState: ItineraryModalFormState;
  onModalFormStateChange: (context: ItineraryModalFormState) => void;
  onCategoryWarningChange: (categoryWarning?: string) => void;
  currentSubCategory?: SubCategory;
  categoryColors: CategoryColors;
  submitAttempted?: boolean;
  isNameEmpty?: boolean;
};

const ItineraryModalFormHeader = ({
  modalFormState,
  onModalFormStateChange,
  onCategoryWarningChange,
  currentSubCategory,
  categoryColors,
  submitAttempted,
  isNameEmpty,
}: ItineraryModalFormHeaderProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTimetableItem',
  });

  // Category
  const categoryOptions = useCategoryOptions();

  const handleCategoryChange = (option?: (typeof categoryOptions)[number]) => {
    if (option !== undefined) {
      onModalFormStateChange({
        ...modalFormState,
        category: option.category ?? undefined,
      });
    }
  };

  // RollingStock
  const { rollingStock } = useStoreDataForRollingStockSelector({
    rollingStockId: modalFormState.rollingStockId,
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
      onModalFormStateChange({
        ...modalFormState,
        category: undefined,
        rollingStockId: undefined,
      });
      return;
    }

    onModalFormStateChange({
      ...modalFormState,
      category: rs.primary_category ? { main_category: rs.primary_category } : undefined,
      rollingStockId: rs.id,
    });
  };

  // Composition code/speed limit by tag
  const speedLimitTags = useSpeedLimitTags();

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
    if (!rollingStock || !modalFormState.category) return undefined;

    const isMismatch = isMainCategory(modalFormState.category)
      ? modalFormState.category.main_category !== rollingStock.primary_category &&
        !rollingStock.other_categories.includes(modalFormState.category.main_category)
      : currentSubCategory?.main_category !== rollingStock.primary_category;

    return isMismatch ? t('categoryMismatch') : undefined;
  }, [rollingStock, modalFormState.category, currentSubCategory, t]);

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
            value={categoryOptions.find((option) =>
              isEqual(option.category, modalFormState.category)
            )}
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
            value={modalFormState.speedLimitTag ?? ''}
            {...createStandardSelectOptions(speedLimitTags)}
            onChange={(e) => {
              onModalFormStateChange({
                ...modalFormState,
                speedLimitTag: e,
              });
            }}
          ></Select>
        </div>
        <div className="train-name-input">
          <Input
            narrow
            small
            id="itinerary-modal-timetable-item-name"
            label={t('itineraryModal.trainName')}
            value={modalFormState.name}
            title={modalFormState.name}
            onChange={(e) =>
              onModalFormStateChange({
                ...modalFormState,
                name: e.target.value,
              })
            }
            onBlur={() => setIsNameBlurred(true)}
            onFocus={() => setIsNameBlurred(false)}
            statusWithMessage={nameError}
          />
        </div>
      </div>
    </>
  );
};

export default ItineraryModalFormHeader;
