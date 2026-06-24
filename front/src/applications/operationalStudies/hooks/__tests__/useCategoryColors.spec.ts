import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { SubCategory, TrainCategory } from 'common/api/osrdEditoastApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';

import { DEFAULT_TRAIN_PATH_COLORS, TRAIN_MAIN_CATEGORY_PATH_COLORS } from '../../consts';
import useCategoryColors from '../useCategoryColors';

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

const mockUseSubCategoryContext = vi.mocked(useSubCategoryContext);

describe('useCategoryColors', () => {
  beforeEach(() => {
    mockUseSubCategoryContext.mockReturnValue(mockSubCategories);
  });

  it.each([null, undefined])('should return default colors when category is %s', (category) => {
    const { result } = renderHook(() => useCategoryColors(category));

    expect(result.current.categoryColors).toEqual(DEFAULT_TRAIN_PATH_COLORS);
    expect(result.current.currentSubCategory).toBeUndefined();
  });

  it('should return main category colors for a main category, excluding sub category', () => {
    const category: TrainCategory = { main_category: 'HIGH_SPEED_TRAIN' };
    const { result } = renderHook(() => useCategoryColors(category));

    expect(result.current.categoryColors).toEqual(TRAIN_MAIN_CATEGORY_PATH_COLORS.HIGH_SPEED_TRAIN);
    expect(result.current.currentSubCategory).toBeUndefined();
  });

  it('should return sub category colors when sub category is found', () => {
    const category: TrainCategory = { sub_category_code: 'REGIONAL' };
    const { result } = renderHook(() => useCategoryColors(category));

    expect(result.current.categoryColors).toEqual({
      base: '#ff0000',
      strong: '#cc0000',
      surface: '#ffe0e0',
      soft: '#ff6b43',
    });
    expect(result.current.currentSubCategory).toEqual(mockSubCategories[0]);
  });

  it('should fall back to default colors when sub category has empty color fields', () => {
    const category: TrainCategory = { sub_category_code: 'FREIGHT' };
    const { result } = renderHook(() => useCategoryColors(category));

    expect(result.current.categoryColors).toEqual(DEFAULT_TRAIN_PATH_COLORS);
    expect(result.current.currentSubCategory).toEqual(mockSubCategories[1]);
  });

  it('should return default colors when sub category code is not found', () => {
    const category: TrainCategory = { sub_category_code: 'UNKNOWN' };
    const { result } = renderHook(() => useCategoryColors(category));

    expect(result.current.categoryColors).toEqual(DEFAULT_TRAIN_PATH_COLORS);
    expect(result.current.currentSubCategory).toBeUndefined();
  });
});
