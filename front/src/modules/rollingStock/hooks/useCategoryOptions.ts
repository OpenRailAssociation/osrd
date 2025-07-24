import { useTranslation } from 'react-i18next';

import {
  osrdEditoastApi,
  type SubCategory,
  type TrainMainCategory,
} from 'common/api/osrdEditoastApi';
import { TrainMainCategoryDict } from 'modules/rollingStock/consts';

export type TrainCategory =
  | {
      main_category: TrainMainCategory;
    }
  | {
      sub_category_code: string;
    };

export type CategoryOptionWithId = {
  id: TrainMainCategory | string;
  label: string;
};

export default function useCategoryOptions(withPlaceholder = true) {
  const { t } = useTranslation();

  const { data: _data } = osrdEditoastApi.endpoints.getSubCategory.useQuery({
    page: 1,
    pageSize: 100,
  });

  const subCategoriesMocked: SubCategory[] = [
    {
      code: 'uuid-123',
      color: '#FFFFFF',
      main_category: 'FREIGHT_TRAIN',
      name: 'ABC',
    },
    {
      code: 'uuid-456',
      color: '#AAAAAA',
      main_category: 'HIGH_SPEED_TRAIN',
      name: '123',
    },
  ];

  const validMainCategories = Object.keys(TrainMainCategoryDict) as TrainMainCategory[];

  const groupedOptions: CategoryOptionWithId[] = [];

  for (const mainCategory of validMainCategories) {
    groupedOptions.push({
      id: mainCategory,
      label: t(`rollingStock.categoriesOptions.${mainCategory}`),
    });

    const subCategories = subCategoriesMocked.filter((sub) => sub.main_category === mainCategory);

    groupedOptions.push(
      ...subCategories.map((sub) => ({
        id: sub.code,
        label: sub.name,
      }))
    );
  }

  if (withPlaceholder) {
    return [
      {
        label: t('rollingStock.categoriesOptions.choose'),
      },
      ...groupedOptions,
    ];
  }
  return groupedOptions;
}
