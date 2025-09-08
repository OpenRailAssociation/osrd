import { useTranslation } from 'react-i18next';

import { useSubCategoryContext } from 'common/SubCategoryContext';
import { TrainMainCategoryDict } from 'modules/rollingStock/consts';

import type { CategoryOptionWithId } from '../types';

export type CategoryOption = { id?: string; label: string };

export default function useCategoryOptions(withPlaceholder = true) {
  const { t } = useTranslation();

  const subCategories = useSubCategoryContext();

  const validMainCategories = Array.from(Object.values(TrainMainCategoryDict));

  const groupedOptions: CategoryOptionWithId[] = [];

  for (const mainCategory of validMainCategories) {
    groupedOptions.push({
      id: `main:${mainCategory}`,
      label: t(`rollingStock.categoriesOptions.${mainCategory}`),
      category: { main_category: mainCategory },
    });

    const matchedSubCategories = subCategories.filter((sub) => sub.main_category === mainCategory);

    groupedOptions.push(
      ...matchedSubCategories.map((sub) => ({
        id: `sub:${sub.code}`,
        label: sub.name,
        category: { sub_category_code: sub.code },
        color: sub.color,
        background_color: sub.background_color,
        hovered_color: sub.hovered_color,
        main_category: sub.main_category,
      }))
    );
  }

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
