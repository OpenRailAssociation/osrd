import { useTranslation } from 'react-i18next';

import type { TrainMainCategory } from 'common/api/osrdEditoastApi';
import { TrainMainCategoryDict } from 'modules/rollingStock/consts';

export type CategoryOptionWithId = { id: TrainMainCategory; label: string };

export type CategoryOption = { id?: TrainMainCategory; label: string };

export default function useCategoryOptions(withPlaceholder = true) {
  const { t } = useTranslation();

  const options = Object.values(TrainMainCategoryDict).map((category) => ({
    id: category,
    label: t(`rollingStock.categoriesOptions.${category}`),
  }));

  if (withPlaceholder) {
    return [{ label: t('rollingStock.categoriesOptions.choose') }, ...options];
  }

  return options as CategoryOptionWithId[];
}
