import { skipToken } from '@reduxjs/toolkit/query';
import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { SUBJECT_TYPES } from 'common/authorization/consts';

import useSearchUsers, { DEBOUNCE_DURATION, type User } from '../useSearchUsers';

const searchTermA = 'lphons';
const searchTermB = 'Bea';
const searchTermC = 'harl';

const searchedUsersA = [{ id: 1, name: 'Alphonse', type: SUBJECT_TYPES.USER }];
const searchedUsersB = [
  { id: 2, name: 'Bea', type: SUBJECT_TYPES.USER },
  { id: 3, name: 'Beatrice', type: SUBJECT_TYPES.USER },
];
const searchedUsersC: User[] = [];

const apiResultsBySearchTerm: Record<string, User[]> = {
  [searchTermA]: searchedUsersA,
  [searchTermB]: searchedUsersB,
  [searchTermC]: searchedUsersC,
};

describe('useSearchUsers', () => {
  let useQuerySpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();
    useQuerySpy = vi.spyOn(osrdEditoastApi.endpoints.postSearch, 'useQuery').mockImplementation(((
      arg
    ) => {
      if (arg === skipToken) return { data: undefined };
      // Queries form is ['search', ['name'], searchTerm]
      const searchTerm = (arg.searchPayload.query as [string, string[], string])[2];
      return { data: apiResultsBySearchTerm[searchTerm] };
    }) as typeof osrdEditoastApi.endpoints.postSearch.useQuery);
  });

  afterAll(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should send a search request when a search term is sent and eventually return its result', () => {
    const { result } = renderHook(() => useSearchUsers());
    expect(result.current.searchedUsers).toEqual([]);

    act(() => result.current.setSearchTerm(searchTermA));
    act(() => vi.advanceTimersByTime(DEBOUNCE_DURATION));

    expect(useQuerySpy).toHaveBeenLastCalledWith({
      searchPayload: {
        object: 'user',
        query: ['search', ['name'], searchTermA],
      },
      pageSize: 101,
    });
    expect(result.current.searchedUsers).toEqual(searchedUsersA);
  });

  it('should debounce requests on search term changes', () => {
    const { result } = renderHook(() => useSearchUsers());
    expect(result.current.searchedUsers).toEqual([]);

    act(() => result.current.setSearchTerm(searchTermB));
    expect(result.current.searchedUsers).toEqual([]);

    act(() => vi.advanceTimersByTime(DEBOUNCE_DURATION - 1));
    expect(result.current.searchedUsers).toEqual([]);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.searchedUsers).toEqual(searchedUsersB);

    act(() => result.current.setSearchTerm(searchTermC));
    expect(result.current.searchedUsers).toEqual(searchedUsersB);

    act(() => vi.advanceTimersByTime(DEBOUNCE_DURATION - 1));
    expect(result.current.searchedUsers).toEqual(searchedUsersB);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.searchedUsers).toEqual(searchedUsersC);
  });

  it('should skip the request and return an empty list after the debounce timer when the term is removed', () => {
    const { result } = renderHook(() => useSearchUsers());
    expect(useQuerySpy).toHaveBeenLastCalledWith(skipToken);
    expect(result.current.searchedUsers).toEqual([]);

    act(() => result.current.setSearchTerm(searchTermA));
    act(() => vi.advanceTimersByTime(DEBOUNCE_DURATION));
    expect(result.current.searchedUsers).toEqual(searchedUsersA);

    act(() => result.current.setSearchTerm(''));
    act(() => vi.advanceTimersByTime(DEBOUNCE_DURATION - 1));
    expect(useQuerySpy).not.toHaveBeenLastCalledWith(skipToken);
    expect(result.current.searchedUsers).toEqual(searchedUsersA);

    act(() => vi.advanceTimersByTime(1));
    expect(useQuerySpy).toHaveBeenLastCalledWith(skipToken);
    expect(result.current.searchedUsers).toEqual([]);
  });

  it('should eventually return an empty list when resetSuggestions is called', () => {
    const { result } = renderHook(() => useSearchUsers());
    act(() => result.current.setSearchTerm(searchTermA));
    act(() => vi.advanceTimersByTime(DEBOUNCE_DURATION));
    expect(result.current.searchedUsers).toEqual(searchedUsersA);

    act(() => result.current.resetSuggestions());
    act(() => vi.advanceTimersByTime(DEBOUNCE_DURATION));
    expect(result.current.searchedUsers).toEqual([]);
  });
});
