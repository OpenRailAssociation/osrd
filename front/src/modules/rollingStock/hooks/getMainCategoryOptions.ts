import type { TFunction } from 'i18next';

import type { TrainMainCategory } from 'common/api/osrdEditoastApi';
import { TrainMainCategoryDict } from 'modules/rollingStock/consts';

export type MainCategoryOptionWithId = { id: TrainMainCategory; label: string };

export function getMainCategoryOptions(
  t: TFunction<'translation', 'rollingStock'>,
  withPlaceholder = true
): (MainCategoryOptionWithId | { label: string })[] {
  const options = Array.from(Object.values(TrainMainCategoryDict)).map((category) => ({
    id: category,
    label: t(`categoriesOptions.${category}`),
  }));

  if (withPlaceholder) {
    return [{ label: t('categoriesOptions.choose') }, ...options];
  }

  return options;
}
