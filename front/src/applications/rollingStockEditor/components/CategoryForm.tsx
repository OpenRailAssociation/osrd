import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { TrainMainCategory } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import { TrainMainCategoryDict } from 'modules/rollingStock/consts';
import { getMainCategoryOptions } from 'modules/rollingStock/hooks/getMainCategoryOptions';

import type { RollingStockParametersValues } from '../types';

type CategoryOption = { id?: TrainMainCategory; label: string };

type RollingStockEditorCategoryFormProps = {
  rollingStockValues: RollingStockParametersValues;
  setRollingStockValues: (
    rollingStockValue: React.SetStateAction<RollingStockParametersValues>
  ) => void;
};

const RollingStockEditorCategoryForm = ({
  rollingStockValues,
  setRollingStockValues,
}: RollingStockEditorCategoryFormProps) => {
  const { t } = useTranslation('translation', { keyPrefix: 'rollingStock' });

  const mainCategoriesOptions = getMainCategoryOptions(t);

  const handlePrimaryCategoryChange = (selectedCategory?: CategoryOption) => {
    setRollingStockValues((prevValues) => {
      if (selectedCategory?.id) {
        prevValues.categories.add(selectedCategory.id);
      }
      return {
        ...prevValues,
        primaryCategory: selectedCategory?.id,
      };
    });
  };

  const handleOtherCategoryChange =
    (category: TrainMainCategory) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setRollingStockValues((prevValues) => {
        if (e.target.checked) {
          prevValues.categories.add(category);
        } else {
          prevValues.categories.delete(category);
        }
        return { ...prevValues };
      });
    };

  return (
    <div className="rollingstock-editor-input-container px-1 pb-3">
      {/* Primary Category Selection */}
      <div className="d-flex align-items-center justify-content-between col rollingstock-editor-select mb-4">
        <SelectSNCF
          sm
          id="primary-category-selector"
          data-testid="primary-category-selector"
          name="primary-category-selector"
          label={`${t('primaryCategory')} *`}
          value={
            rollingStockValues.primaryCategory
              ? {
                  id: rollingStockValues.primaryCategory,
                  label: t(`categoriesOptions.${rollingStockValues.primaryCategory}`),
                }
              : { label: t('categoriesOptions.choose') }
          }
          options={mainCategoriesOptions}
          onChange={handlePrimaryCategoryChange}
        />
      </div>

      {/* Other Categories Selection */}
      <div className="col">
        <label className="form-label" htmlFor="rs_category_checkboxes">
          {t('otherCategories')}
        </label>
        <div className="d-flex flex-wrap" id="rs_category_checkboxes">
          {Array.from(Object.values(TrainMainCategoryDict)).map((category) => (
            <div key={category} className={cx('col-12', 'col-sm-6', 'col-lg-4', 'mb-2')}>
              <CheckboxRadioSNCF
                type="checkbox"
                id={`category-checkbox-${category}`}
                data-testid={`category-checkbox-${category}`}
                name={`category-checkbox-${category}`}
                label={t(`categoriesOptions.${category}`)}
                checked={rollingStockValues.categories.has(category)}
                onChange={handleOtherCategoryChange(category)}
                disabled={rollingStockValues.primaryCategory === category}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RollingStockEditorCategoryForm;
