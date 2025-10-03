import { ComboBox, Input, Select } from '@osrd-project/ui-core';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import useStoreDataForRollingStockSelector from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import isMainCategory from 'modules/rollingStock/helpers/category';
import useCategoryOptions from 'modules/rollingStock/hooks/useCategoryOptions';
import {
  DEFAULT_TRAIN_PATH_COLORS,
  TRAIN_MAIN_CATEGORY_PATH_COLORS,
} from 'modules/simulationResult/consts';
import { updateCategory, updateName } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getCategory,
  getName,
  getOperationalStudiesRollingStockID,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';

const ItineraryModalFormHeader = () => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTimetableItem',
  });

  // Category
  const categoryOptions = useCategoryOptions();
  const category = useSelector(getCategory);
  const subCategories = useSubCategoryContext();
  const currentSubCategory =
    category && !isMainCategory(category)
      ? subCategories.find((option) => option.code === category.sub_category_code)
      : undefined;
  const handleCategoryChange = (option?: (typeof categoryOptions)[number]) => {
    if (option !== undefined) {
      dispatch(updateCategory(option.category));
    }
  };

  // Category colors
  let colors = DEFAULT_TRAIN_PATH_COLORS;
  if (category && isMainCategory(category)) {
    colors = TRAIN_MAIN_CATEGORY_PATH_COLORS[category.main_category];
  } else if (category && !isMainCategory(category) && currentSubCategory) {
    colors = {
      normal: currentSubCategory.color || DEFAULT_TRAIN_PATH_COLORS.normal,
      hovered: currentSubCategory.hovered_color || DEFAULT_TRAIN_PATH_COLORS.hovered,
      background: currentSubCategory.background_color || DEFAULT_TRAIN_PATH_COLORS.background,
    };
  }

  // RollingStock
  const rollingStockId = useSelector(getOperationalStudiesRollingStockID);
  const { rollingStock } = useStoreDataForRollingStockSelector({
    rollingStockId,
  });
  const getRollingStockLabel = (option: LightRollingStockWithLiveries) => {
    const rs = option;
    if (!rs) return '';
    const secondPart = rs.metadata?.series || rs.metadata?.reference || '';
    return secondPart ? `${rs.name} - ${secondPart}` : rs.name;
  };

  // Timetable item name
  const name = useSelector(getName);
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateName(e.target.value));
  };

  return (
    <>
      <div className="category-row">
        <div
          className="category-color"
          style={{
            backgroundColor: colors.normal,
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
            readOnly
          ></Select>
        </div>
      </div>
      <div className="rolling-stock-and-name-row">
        <div className="rolling-stock-combobox">
          <ComboBox
            id="itinerary-modal-rolling-stock"
            label={t('rollingstock')}
            narrow
            small
            autoComplete="off"
            value={rollingStock}
            getSuggestionLabel={getRollingStockLabel}
            onSelectSuggestion={() => {}}
            suggestions={[]}
            resetSuggestions={() => {}}
            readOnly
          />
        </div>

        <div className="train-name-input">
          <Input
            narrow
            small
            id="itinerary-modal-timetable-item-name"
            label={t('itineraryModal.trainName')}
            value={name}
            onChange={handleNameChange}
            readOnly
          />
        </div>
      </div>
    </>
  );
};

export default ItineraryModalFormHeader;
