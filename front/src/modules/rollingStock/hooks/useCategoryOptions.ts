import { useTranslation } from 'react-i18next';

import type { TrainCategory } from 'common/api/osrdEditoastApi';
import { TrainCategoryDict } from 'modules/rollingStock/consts';

export type CategoryOptionWithId = { id: TrainCategory; label: string };

export type CategoryOption = { id?: TrainCategory; label: string };

export default function useCategoryOptions(withPlaceholder = true) {
  const { t } = useTranslation();

  const options = Object.values(TrainCategoryDict).map((category) => ({
    id: category,
    label: t(`rollingStock.categoriesOptions.${category}`),
  }));

  if (withPlaceholder) {
    return [{ label: t('rollingStock.categoriesOptions.choose') }, ...options];
  }

  return options as CategoryOptionWithId[];
}
