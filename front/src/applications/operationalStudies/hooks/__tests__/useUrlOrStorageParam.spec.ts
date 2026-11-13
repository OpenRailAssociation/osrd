import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import useUrlOrStorageParam from '../useUrlOrStorageParam';

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  useLocation: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: mocks.useParams,
  useLocation: mocks.useLocation,
  useNavigate: () => mocks.navigate,
}));

const SCENARIO_PATHNAME = '/operational-studies/projects/1/studies/2/scenarios/42';
const KEY_PREFIX = 'timetable';
const STORAGE_KEY = 'timetable_project1_study2_scenario42_timetable';

describe('useUrlOrStorageParam', () => {
  beforeEach(() => {
    mocks.useParams.mockReturnValue({ projectId: '1', studyId: '2', scenarioId: '42' });
    mocks.useLocation.mockReturnValue({ pathname: SCENARIO_PATHNAME, search: '' });
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getParamFromUrlOrStorage', () => {
    it('should return the URL value even if the local storage has another one', () => {
      mocks.useLocation.mockReturnValue({ pathname: SCENARIO_PATHNAME, search: '?timetable=100' });
      localStorage.setItem(STORAGE_KEY, '200');

      const { result } = renderHook(() => useUrlOrStorageParam(KEY_PREFIX));

      expect(result.current.getParamFromUrlOrStorage('timetable')).toBe('100');
    });

    it('should fall back to the local storage when the param is not in the URL', () => {
      localStorage.setItem(STORAGE_KEY, '200');

      const { result } = renderHook(() => useUrlOrStorageParam(KEY_PREFIX));

      expect(result.current.getParamFromUrlOrStorage('timetable')).toBe('200');
    });

    it('should return undefined when the param is neither in the URL nor in the local storage', () => {
      const { result } = renderHook(() => useUrlOrStorageParam(KEY_PREFIX));

      expect(result.current.getParamFromUrlOrStorage('timetable')).toBeUndefined();
    });

    it('should not read a value saved with another key prefix', () => {
      localStorage.setItem('useAutoSelectTrainIds_project1_study2_scenario42_selected_train', '5');

      const { result } = renderHook(() => useUrlOrStorageParam(KEY_PREFIX));

      expect(result.current.getParamFromUrlOrStorage('selected_train')).toBeUndefined();
    });
  });

  describe('setParamsInUrlAndStorage', () => {
    it('should save the param in the URL and in the local storage', async () => {
      mocks.useLocation.mockReturnValue({
        pathname: SCENARIO_PATHNAME,
        search: '?selected_train=5',
      });
      const { result } = renderHook(() => useUrlOrStorageParam(KEY_PREFIX));

      await result.current.setParamsInUrlAndStorage('timetable', '100');

      expect(localStorage.getItem(STORAGE_KEY)).toBe('100');
      expect(mocks.navigate).toHaveBeenCalledWith(
        `${SCENARIO_PATHNAME}?selected_train=5&timetable=100`,
        { replace: true }
      );
    });

    it('should remove the param from the URL and from the local storage when the value is undefined', async () => {
      mocks.useLocation.mockReturnValue({
        pathname: SCENARIO_PATHNAME,
        search: '?selected_train=5&timetable=100',
      });
      localStorage.setItem(STORAGE_KEY, '100');
      const { result } = renderHook(() => useUrlOrStorageParam(KEY_PREFIX));

      await result.current.setParamsInUrlAndStorage('timetable', undefined);

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(mocks.navigate).toHaveBeenCalledWith(`${SCENARIO_PATHNAME}?selected_train=5`, {
        replace: true,
      });
    });
  });
});
