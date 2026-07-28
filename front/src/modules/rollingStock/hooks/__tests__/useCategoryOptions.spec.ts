import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import type { SubCategory } from 'common/api/osrdEditoastApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';

import type { CategoryOptionWithId } from '../../types';
import useCategoryOptions from '../useCategoryOptions';

vi.mock('common/SubCategoryContext', () => ({
  useSubCategoryContext: vi.fn(),
}));

const mockSubCategories: SubCategory[] = [
  {
    code: 'REGIONAL',
    name: 'Regional Train',
    main_category: 'REGIONAL_TRAIN',
    color: '#ff0000',
    hovered_color: '#cc0000',
    background_color: '#ffe0e0',
  },
  {
    code: 'FREIGHT',
    name: 'Freight Train',
    main_category: 'FREIGHT_TRAIN',
    color: '',
    hovered_color: '',
    background_color: '',
  },
];

const placeholder: CategoryOptionWithId = {
  id: 'placeholder',
  label: 'rollingStock.categoriesOptions.choose',
  category: null,
};

const options: CategoryOptionWithId[] = [
  {
    id: 'main:REGIONAL_TRAIN',
    label: 'rollingStock.categoriesOptions.REGIONAL_TRAIN',
    category: { main_category: 'REGIONAL_TRAIN' },
  },
  {
    id: 'main:FREIGHT_TRAIN',
    label: 'rollingStock.categoriesOptions.FREIGHT_TRAIN',
    category: { main_category: 'FREIGHT_TRAIN' },
  },
];

const subCategoryOptions: CategoryOptionWithId[] = [
  {
    id: 'sub:REGIONAL',
    label: 'Regional Train',
    category: { sub_category_code: 'REGIONAL' },
    color: '#ff0000',
    background_color: '#ffe0e0',
    hovered_color: '#cc0000',
    main_category: 'REGIONAL_TRAIN',
  },
  {
    id: 'sub:FREIGHT',
    label: 'Freight Train',
    category: { sub_category_code: 'FREIGHT' },
    color: '',
    background_color: '',
    hovered_color: '',
    main_category: 'FREIGHT_TRAIN',
  },
];

const fullOptions = [...options, ...subCategoryOptions];
const fullOptionsWithPlaceholder = [placeholder, ...fullOptions];

const mockUseSubCategoryContext = vi.mocked(useSubCategoryContext);

describe('useCategoryOptions', () => {
  beforeAll(() => {
    mockUseSubCategoryContext.mockReturnValue(mockSubCategories);
  });

  it('should return options with placeholder when withPlaceholder is true', () => {
    const { result } = renderHook(() => useCategoryOptions());

    expect(result.current).toEqual(expect.arrayContaining(fullOptionsWithPlaceholder));
  });

  it('should return options without placeholder when withPlaceholder is false', () => {
    const { result } = renderHook(() => useCategoryOptions(false));

    expect(result.current).toEqual(expect.arrayContaining(fullOptions));

    expect(result.current).not.toContainEqual(placeholder);
  });
});
