import { useTranslation } from 'react-i18next';

import type { TrainCategory } from 'common/api/osrdEditoastApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { TrainMainCategoryDict } from 'modules/rollingStock/consts';

import type { CategoryOptionWithId } from '../types';

export function categoryOptionId(category: TrainCategory): string {
  if ('main_category' in category) {
    return `main:${category.main_category}`;
  } else {
    return `sub:${category.sub_category_code}`;
  }
}

/**
 * Custom hook to generate category options for a dropdown or selection component.
 * It combines main categories and their corresponding subcategories into a single list of options.
 *
 * @param withPlaceholder - A boolean indicating whether to include a placeholder option at the beginning of the list. Default is true.
 * @returns An array of category options, each with an id, label, and associated category information.
 */
export default function useCategoryOptions(withPlaceholder = true) {
  const { t } = useTranslation();

  const subCategories = useSubCategoryContext();

  const validMainCategories = Array.from(Object.values(TrainMainCategoryDict));

  const mainCategoryOptions: CategoryOptionWithId[] = validMainCategories.map((mainCategory) => ({
    id: categoryOptionId({ main_category: mainCategory }),
    label: t(`rollingStock.categoriesOptions.${mainCategory}`),
    category: { main_category: mainCategory },
  }));

  const subCategoryOptions: CategoryOptionWithId[] = validMainCategories.flatMap((mainCategory) => {
    const matchedSubCategories = subCategories.filter((sub) => sub.main_category === mainCategory);

    return matchedSubCategories.map((sub) => ({
      id: categoryOptionId({ sub_category_code: sub.code }),
      label: sub.name,
      category: { sub_category_code: sub.code },
      color: sub.color,
      background_color: sub.background_color,
      hovered_color: sub.hovered_color,
      main_category: sub.main_category,
    }));
  });

  const groupedOptions = [...mainCategoryOptions, ...subCategoryOptions];

  if (withPlaceholder) {
    return [
      {
        id: 'placeholder',
        label: t('rollingStock.categoriesOptions.choose'),
        category: null,
      },
      ...groupedOptions,
    ];
  }
  return groupedOptions;
}
