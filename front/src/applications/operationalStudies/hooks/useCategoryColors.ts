import { useMemo } from 'react';

import type { TrainCategory } from 'common/api/osrdEditoastApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import isMainCategory from 'modules/rollingStock/helpers/category';

import { DEFAULT_TRAIN_PATH_COLORS, TRAIN_MAIN_CATEGORY_PATH_COLORS } from '../consts';
import type { CategoryColors } from '../types';

const useCategoryColors = (category: TrainCategory | null | undefined) => {
  const subCategories = useSubCategoryContext();

  const currentSubCategory =
    category && !isMainCategory(category)
      ? subCategories.find((option) => option.code === category.sub_category_code)
      : undefined;

  const categoryColors: CategoryColors = useMemo(() => {
    if (category && isMainCategory(category)) {
      return TRAIN_MAIN_CATEGORY_PATH_COLORS[category.main_category];
    }

    if (category && !isMainCategory(category) && currentSubCategory) {
      return {
        normal: currentSubCategory.color || DEFAULT_TRAIN_PATH_COLORS.normal,
        hovered: currentSubCategory.hovered_color || DEFAULT_TRAIN_PATH_COLORS.hovered,
        background: currentSubCategory.background_color || DEFAULT_TRAIN_PATH_COLORS.background,
      };
    }

    return DEFAULT_TRAIN_PATH_COLORS;
  }, [category, currentSubCategory]);

  return { categoryColors, currentSubCategory };
};

export default useCategoryColors;
