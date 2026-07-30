import type { TFunction } from 'i18next';

import type { PacedTrain } from 'applications/operationalStudies/types';
import type { SubCategory } from 'common/api/osrdEditoastApi';
import { findSubCategory } from 'modules/rollingStock/helpers/category';
import type { Train } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

export const getShortDepartureDate = (train: Train, locale?: Intl.Locale) =>
  train && train.start_time
    ? new Date(train.start_time).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      })
    : null;

export const getShortCategoryName = (
  train: Train,
  t: TFunction<'translation'>,
  subCategories: SubCategory[]
): string | undefined => {
  const category = train.category;
  if (!category) return undefined;
  if ('main_category' in category)
    return t(`translation:rollingStock.shortCategoriesOptions.${category.main_category}`);
  return findSubCategory(subCategories, category)?.name;
};

export const getComfortType = (train: Train, t: TFunction<'translation'>): string | null =>
  train.comfort ? t(`translation:rollingStock.comfortTypes.${train.comfort}`) : '';

export const getServiceInterval = (train: PacedTrain): number =>
  Duration.parse(train.paced.interval).total('minute');

export const getServiceWindow = (train: PacedTrain): number =>
  Duration.parse(train.paced.time_window).total('minute');
