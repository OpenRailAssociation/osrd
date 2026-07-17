import type { LightRollingStock, SubCategory, TrainCategory } from 'common/api/osrdEditoastApi';

export default function isMainCategory(category: TrainCategory | null) {
  return category === null || 'main_category' in category;
}

export const findSubCategory = (
  subCategories: SubCategory[],
  category: TrainCategory | null | undefined
) =>
  !category || isMainCategory(category)
    ? undefined
    : subCategories.find((option) => option.code === category.sub_category_code);

export function checkCategoryWarning(
  rollingStock: LightRollingStock | string | undefined,
  currentCategory: TrainCategory | null,
  currentSubCategory?: SubCategory
): boolean {
  if (!rollingStock || typeof rollingStock === 'string' || !currentCategory) return false;

  if (isMainCategory(currentCategory)) {
    return (
      currentCategory.main_category !== rollingStock.primary_category &&
      !rollingStock.other_categories.includes(currentCategory.main_category)
    );
  }

  if (currentSubCategory) {
    return currentSubCategory.main_category !== rollingStock.primary_category;
  }

  return false;
}
