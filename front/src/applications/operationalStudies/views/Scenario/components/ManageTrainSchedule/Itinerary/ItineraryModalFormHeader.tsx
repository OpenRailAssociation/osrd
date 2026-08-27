import { useCallback, useEffect, useMemo } from 'react';

import { ComboBox, Input, Select, useDefaultComboBox } from '@osrd-project/ui-core';
import { skipToken } from '@reduxjs/toolkit/query';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { CategoryColors } from 'applications/operationalStudies/types';
import {
  osrdEditoastApi,
  type LightRollingStockWithLiveries,
  type SubCategory,
} from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import useSpeedLimitTags from 'common/SpeedLimitTagSelector/useSpeedLimitTags';
import isMainCategory from 'modules/rollingStock/helpers/category';
import useCategoryOptions from 'modules/rollingStock/hooks/useCategoryOptions';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import { createStandardSelectOptions } from 'utils/uiCoreHelpers';

import type { ItineraryModalFormState } from './ItineraryModal';

type ItineraryModalFormHeaderProps = {
  modalFormState: ItineraryModalFormState;
  onModalFormStateChange: (context: ItineraryModalFormState) => void;
  onCategoryWarningChange: (categoryWarning?: string) => void;
  onRollingStockMessageChange: (message?: string) => void;
  currentSubCategory?: SubCategory;
  categoryColors: CategoryColors;
};

const ItineraryModalFormHeader = ({
  modalFormState,
  onModalFormStateChange,
  onCategoryWarningChange,
  onRollingStockMessageChange,
  currentSubCategory,
  categoryColors,
}: ItineraryModalFormHeaderProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule',
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

  const { currentData: rollingStock } =
    osrdEditoastApi.endpoints.getRollingStockByRollingStockId.useQuery(
      modalFormState.rollingStockId
        ? {
            rollingStockId: modalFormState.rollingStockId,
          }
        : skipToken
    );

  const getRollingStockLabel = useCallback((rs: LightRollingStockWithLiveries) => {
    const secondPart = rs.metadata?.series || rs.metadata?.reference || '';
    return secondPart ? `${rs.name} - ${secondPart}` : rs.name;
  }, []);

  const { filteredRollingStockList: fullRollingStockList } = useFilterRollingStock();

  const {
    suggestions: rollingStockSuggestions,
    onChange: onRollingStockQueryChange,
    resetSuggestions: resetRollingStockSuggestions,
  } = useDefaultComboBox(fullRollingStockList, getRollingStockLabel);

  // Rolling stock value for ComboBox
  const rollingStockValue = rollingStock
    ? getRollingStockLabel(rollingStock)
    : modalFormState.rollingStockName;

  // When user types or clears input
  const handleRollingStockInputChange = (newValue: string) => {
    onRollingStockQueryChange(newValue);
    onModalFormStateChange({
      ...modalFormState,
      rollingStockId: undefined,
      rollingStockName: newValue,
    });
  };

  // When user selects a suggestion
  const handleRollingStockSelect = (label?: string) => {
    const rs = fullRollingStockList.find((r) => getRollingStockLabel(r) === label);
    if (rs) {
      const newFormState = { ...modalFormState, rollingStockId: rs.id, rollingStockName: rs.name };
      if (!modalFormState.category && rs.primary_category) {
        newFormState.category = { main_category: rs.primary_category };
      }
      onModalFormStateChange(newFormState);
    } else {
      // Custom value or empty
      onModalFormStateChange({
        ...modalFormState,
        rollingStockId: undefined,
        rollingStockName: label ?? '',
      });
    }
  };

  // Composition code/speed limit by tag
  const infraID = useInfraID();
  const speedLimitTags = useSpeedLimitTags(infraID);

  const rollingStockMessage = useMemo(() => {
    if (!rollingStockValue) {
      return t('noRollingStock');
    }
    const isValid = fullRollingStockList.some(
      (rs) => getRollingStockLabel(rs) === rollingStockValue
    );
    return isValid ? undefined : t('unknownRollingStock');
  }, [rollingStockValue, fullRollingStockList, t]);

  // Category warning
  useEffect(() => {
    if (!rollingStock || !modalFormState.category) {
      onCategoryWarningChange(undefined);
      return;
    }

    const isMismatch = isMainCategory(modalFormState.category)
      ? modalFormState.category.main_category !== rollingStock.primary_category &&
        !rollingStock.other_categories.includes(modalFormState.category.main_category)
      : currentSubCategory?.main_category !== rollingStock.primary_category;

    onCategoryWarningChange(isMismatch ? t('categoryMismatch') : undefined);
  }, [rollingStock, modalFormState.category, currentSubCategory, t]);

  useEffect(() => {
    onRollingStockMessageChange(rollingStockMessage);
  }, [rollingStockMessage]);

  return (
    <>
      <div className="category-row">
        <div
          className="category-color"
          style={{
            backgroundColor: categoryColors.base,
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
            data-testid="itinerary-modal-category"
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
            value={rollingStockValue ?? ''}
            suggestions={rollingStockSuggestions.map(getRollingStockLabel)}
            getSuggestionLabel={(s) => s}
            onSelectSuggestion={handleRollingStockSelect}
            resetSuggestions={resetRollingStockSuggestions}
            onChange={handleRollingStockInputChange}
            data-testid="itinerary-modal-rolling-stock"
            testIdPrefix="rolling-stock-combobox"
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
            data-testid="itinerary-modal-composition-code"
          ></Select>
        </div>
        <div className="train-name-input">
          <Input
            narrow
            small
            id="itinerary-modal-train-schedule-name"
            data-testid="itinerary-modal-train-name"
            label={t('itineraryModal.trainName')}
            value={modalFormState.name}
            title={modalFormState.name}
            onChange={(e) =>
              onModalFormStateChange({
                ...modalFormState,
                name: e.target.value,
              })
            }
          />
        </div>
      </div>
    </>
  );
};

export default ItineraryModalFormHeader;
