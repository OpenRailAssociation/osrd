import { useTranslation } from 'react-i18next';

import {
  osrdEditoastApi,
  type SubCategory,
  type TrainCategory,
  type TrainMainCategory,
} from 'common/api/osrdEditoastApi';
import { TrainMainCategoryDict } from 'modules/rollingStock/consts';

export type CategoryOptionWithId = {
  id: string;
  label: string;
  category: TrainCategory | null;
  color?: string;
  main_category?: TrainMainCategory;
};

export type CategoryOption = { id?: string; label: string };

const subCategoriesMocked: SubCategory[] = [
  {
    code: 'GV',
    color: '#FF0000',
    main_category: 'HIGH_SPEED_TRAIN',
    name: 'TGV radial',
  },
  {
    code: 'IS',
    color: '#FF00FF',
    main_category: 'HIGH_SPEED_TRAIN',
    name: 'TGV intersecteur',
  },
  {
    code: 'MR',
    color: '#FF8000',
    main_category: 'REGIONAL_TRAIN',
    name: 'Train de maille régionale accélérée',
  },
  {
    code: 'PU',
    color: '#0000FF',
    main_category: 'REGIONAL_TRAIN',
    name: 'Périurbain',
  },
  {
    code: 'RER',
    color: '#A0C8FF',
    main_category: 'COMMUTER_TRAIN',
    name: 'RER Parisien',
  },
  {
    code: 'BI',
    color: '#000000',
    main_category: 'COMMUTER_TRAIN',
    name: 'Banlieue Île de France',
  },
];

export default function useCategoryOptions(withPlaceholder = true) {
  const { t } = useTranslation();

  const { data } = osrdEditoastApi.endpoints.getSubCategory.useQuery({
    page: 1,
    pageSize: 100,
  });

  // todo: remove mocked data when backend is ready
  const subCategoriesFromApiOrMocked =
    data && data.results && data.results.length > 0 ? data.results : subCategoriesMocked;

  const validMainCategories = Object.keys(TrainMainCategoryDict) as TrainMainCategory[];

  const groupedOptions: CategoryOptionWithId[] = [];

  for (const mainCategory of validMainCategories) {
    groupedOptions.push({
      id: `main:${mainCategory}`,
      label: t(`rollingStock.categoriesOptions.${mainCategory}`),
      category: { main_category: mainCategory },
    });

    const subCategories = subCategoriesFromApiOrMocked.filter(
      (sub) => sub.main_category === mainCategory
    );

    groupedOptions.push(
      ...subCategories.map((sub) => ({
        id: `sub:${sub.code}`,
        label: sub.name,
        category: { sub_category_code: sub.code },
        color: sub.color,
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
