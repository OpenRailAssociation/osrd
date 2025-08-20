import { createContext, useContext, useEffect, useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { SubCategory } from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';

type SubCategoryContextValue = SubCategory[];

const SubCategoryContext = createContext<SubCategoryContextValue>([]);

export const useSubCategoryContext = (): SubCategoryContextValue => {
  const context = useContext(SubCategoryContext);
  if (!context) {
    throw new Error('useSubCategoryContext must be used within a SubCategoryContextProvider');
  }
  return context;
};

type SubCategoryContextProviderProps = {
  children: React.ReactNode;
};

export const SubCategoryContextProvider = ({ children }: SubCategoryContextProviderProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const { isError, data: { results: subCategories } = { results: [] } } =
    osrdEditoastApi.endpoints.getSubCategory.useQuery({
      pageSize: 100,
    });

  useEffect(() => {
    if (isError) {
      dispatch(
        setFailure({
          name: t('subCategory.errorMessages.unableToRetrieveSubCategory'),
          message: t('subCategory.errorMessages.unableToRetrieveSubCategoryMessage'),
        })
      );
    }
  }, [isError, dispatch, t]);

  const value = useMemo<SubCategoryContextValue>(() => subCategories, [subCategories]);

  return <SubCategoryContext.Provider value={value}>{children}</SubCategoryContext.Provider>;
};
