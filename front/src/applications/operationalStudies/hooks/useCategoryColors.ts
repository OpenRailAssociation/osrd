import { useMemo } from 'react';

import type { TrainCategory } from 'common/api/osrdEditoastApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import isMainCategory, { findSubCategory } from 'modules/rollingStock/helpers/category';

import { DEFAULT_TRAIN_PATH_COLORS, TRAIN_MAIN_CATEGORY_PATH_COLORS } from '../consts';
import getSubCategoryColors from '../helpers/getSubCategoryColors';
import type { CategoryColors } from '../types';

const useCategoryColors = (category: TrainCategory | null | undefined) => {
  const subCategories = useSubCategoryContext();

  const currentSubCategory = findSubCategory(subCategories, category);

  const categoryColors: CategoryColors = useMemo(() => {
    if (category && isMainCategory(category)) {
      return TRAIN_MAIN_CATEGORY_PATH_COLORS[category.main_category];
    }

    if (category && !isMainCategory(category) && currentSubCategory) {
      return getSubCategoryColors(currentSubCategory);
    }

    return DEFAULT_TRAIN_PATH_COLORS;
  }, [category, currentSubCategory]);

  return { categoryColors, currentSubCategory };
};

export default useCategoryColors;
