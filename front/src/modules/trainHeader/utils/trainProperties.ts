import type { TFunction } from 'i18next';

import type { PacedTrainWithPaced } from 'applications/operationalStudies/types';
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

export const getShortCategoryName = (train: Train, t: TFunction<'translation'>): string | null =>
  train.category && 'main_category' in train.category
    ? t(`translation:rollingStock.shortCategoriesOptions.${train.category.main_category}`)
    : null;

export const getCategoryName = (train: Train, t: TFunction<'translation'>): string | null =>
  train.category && 'main_category' in train.category
    ? t(`translation:rollingStock.categoriesOptions.${train.category.main_category}`)
    : null;

export const getComfortType = (train: Train, t: TFunction<'translation'>): string | null =>
  train.comfort ? t(`translation:rollingStock.comfortTypes.${train.comfort}`) : '';

export const getServiceInterval = (train: PacedTrainWithPaced): number =>
  Duration.parse(train.paced.interval).total('minute');

export const getServiceWindow = (train: PacedTrainWithPaced): number =>
  Duration.parse(train.paced.time_window).total('minute');
