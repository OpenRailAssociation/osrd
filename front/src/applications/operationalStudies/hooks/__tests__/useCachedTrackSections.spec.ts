import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { TrackSection } from 'common/api/osrdEditoastApi';

import useCachedTrackSections from '../useCachedTrackSections';

function createTrackSection(overrides: Partial<TrackSection> = {}): TrackSection {
  return {
    id: 'default-id',
    length: 1000,
    curves: [],
    slopes: [],
    geo: {
      type: 'LineString',
      coordinates: [],
    },
    ...overrides,
  };
}

const { apiResult, apiQuery, mockUseLazyQuery } = vi.hoisted(() => ({
  apiResult: vi.fn(),
  apiQuery: vi.fn(() => ({ unwrap: apiResult })),
  mockUseLazyQuery: vi.fn(),
}));

vi.mock('common/api/osrdEditoastApi', () => ({
  osrdEditoastApi: {
    endpoints: {
      postInfraByInfraIdObjectsAndObjectType: {
        useLazyQuery: mockUseLazyQuery,
      },
    },
  },
}));

const infraId = 3000;

const trackVA = createTrackSection({ id: 'VA', length: 4815 });
const trackVB = createTrackSection({ id: 'VB', length: 1623 });

describe('useCachedTrackSections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLazyQuery.mockReturnValue([apiQuery, { isLoading: false }]);
  });

  it('should return some track sections', async () => {
    apiResult.mockResolvedValue([{ railjson: trackVA }, { railjson: trackVB }]);

    const { result } = renderHook(() => useCachedTrackSections(infraId));

    const trackSections = await result.current.getTrackSectionsByIds(['VA', 'VB']);

    expect(apiQuery).toHaveBeenCalledWith({
      infraId: 3000,
      objectType: 'TrackSection',
      body: ['VA', 'VB'],
    });

    expect(trackSections).toEqual({
      VA: trackVA,
      VB: trackVB,
    });
  });

  it('should always return the full cache even if we only request a subset later', async () => {
    apiResult.mockResolvedValue([{ railjson: trackVA }, { railjson: trackVB }]);

    const { result } = renderHook(() => useCachedTrackSections(infraId));

    const twoTracksRequested = await result.current.getTrackSectionsByIds(['VA', 'VB']);
    expect(twoTracksRequested).toEqual({
      VA: trackVA,
      VB: trackVB,
    });

    const oneTrackRequested = await result.current.getTrackSectionsByIds(['VA']);
    expect(oneTrackRequested).toEqual({
      VA: trackVA,
      VB: trackVB,
    });
  });

  it('should deduplicate track IDs to only fetch those that are not in cache', async () => {
    apiResult.mockResolvedValue([{ railjson: trackVA }]);

    const { result } = renderHook(() => useCachedTrackSections(infraId));

    const trackSections1 = await result.current.getTrackSectionsByIds(['VA', 'VA']);

    expect(apiQuery).toHaveBeenCalledWith({
      infraId: 3000,
      objectType: 'TrackSection',
      body: ['VA'],
    });

    expect(trackSections1).toEqual({
      VA: trackVA,
    });

    apiResult.mockResolvedValue([{ railjson: trackVA }, { railjson: trackVB }]);

    const trackSections2 = await result.current.getTrackSectionsByIds(['VA', 'VB']);

    expect(apiQuery).toHaveBeenCalledWith({
      infraId: 3000,
      objectType: 'TrackSection',
      body: ['VB'],
    });

    expect(trackSections2).toEqual({ VA: trackVA, VB: trackVB });
  });

  it('should not call the API at all once the result is cached', async () => {
    apiResult.mockResolvedValue([{ railjson: trackVA }, { railjson: trackVB }]);

    const { result } = renderHook(() => useCachedTrackSections(infraId));

    await result.current.getTrackSectionsByIds(['VA', 'VB']);
    await result.current.getTrackSectionsByIds(['VB']);
    await result.current.getTrackSectionsByIds(['VB', 'VA']);
    await result.current.getTrackSectionsByIds(['VA']);

    expect(apiQuery).toHaveBeenCalledTimes(1);

    await result.current.getTrackSectionsByIds(['VC']);

    expect(apiQuery).toHaveBeenCalledTimes(2);
  });

  it('should emit errors in the console if the call fails', async () => {
    const someApiError = new Error('Oops! Something crashed.');
    apiResult.mockRejectedValue(someApiError);

    const mockedConsoleError = vi.spyOn(console, 'error');
    const { result } = renderHook(() => useCachedTrackSections(infraId));

    await result.current.getTrackSectionsByIds(['VA']);
    expect(mockedConsoleError).toHaveBeenCalledWith(
      'Failed to fetch track sections:',
      someApiError
    );
  });

  it('should change infraId parameter in queries if changed', async () => {
    apiResult.mockResolvedValue([{ railjson: trackVA }]);

    const { result, rerender } = renderHook(
      (hookInfraId: number) => useCachedTrackSections(hookInfraId),
      {
        initialProps: 1234,
      }
    );

    await result.current.getTrackSectionsByIds(['VA']);
    expect(apiQuery).toHaveBeenCalledWith({
      infraId: 1234,
      objectType: 'TrackSection',
      body: ['VA'],
    });

    rerender(5678);

    apiResult.mockResolvedValue([{ railjson: trackVB }]);
    await result.current.getTrackSectionsByIds(['VB']);
    expect(apiQuery).toHaveBeenCalledWith({
      infraId: 5678,
      objectType: 'TrackSection',
      body: ['VB'],
    });
  });
});
