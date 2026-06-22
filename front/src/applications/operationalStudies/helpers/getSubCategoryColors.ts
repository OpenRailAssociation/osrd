import chroma from 'chroma-js';

import type { SubCategory } from 'common/api/osrdEditoastApi';

import { DEFAULT_TRAIN_PATH_COLORS } from '../consts';
import type { CategoryColors } from '../types';

/**
 * Builds the train path colors for a sub category.
 *
 * TODO: drop the workaround once the back exposes a `soft` color for sub categories.
 */
const getSubCategoryColors = (subCategory: SubCategory): CategoryColors => ({
  ...DEFAULT_TRAIN_PATH_COLORS,
  base: subCategory.color || DEFAULT_TRAIN_PATH_COLORS.base,
  strong: subCategory.hovered_color || DEFAULT_TRAIN_PATH_COLORS.strong,
  surface: subCategory.background_color || DEFAULT_TRAIN_PATH_COLORS.surface,
  ...(subCategory.color && {
    soft: chroma(subCategory.color).brighten(1.3).hex(),
  }),
});

export default getSubCategoryColors;
