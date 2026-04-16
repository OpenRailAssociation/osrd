import { renderHookWithStore } from 'store/__tests__';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { mockOsrdEditoastEndpoints } from 'common/api/__mocks__/osrdEditoastApi';
import type { ApiError } from 'common/api/baseGeneratedApis';
import type { InfraObjectWithGeometry, TrackSection } from 'common/api/osrdEditoastApi';

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

function createTrackSectionInfraObject(trackSection: TrackSection): InfraObjectWithGeometry {
  return {
    obj_id: trackSection.id,
    geographic: trackSection.geo,
    railjson: trackSection,
  };
}

const { postInfraByInfraIdObjectsAndObjectType } = mockOsrdEditoastEndpoints;

const infraId = 3000;

const trackVA = createTrackSection({ id: 'VA', length: 4815 });
const trackVB = createTrackSection({ id: 'VB', length: 1623 });
const trackVAInfraObject = createTrackSectionInfraObject(trackVA);
const trackVBInfraObject = createTrackSectionInfraObject(trackVB);

describe('useCachedTrackSections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return some track sections', async () => {
    postInfraByInfraIdObjectsAndObjectType.mockResolvedValue({
      data: [trackVAInfraObject, trackVBInfraObject],
    });

    const { result } = renderHookWithStore(() => useCachedTrackSections(infraId));

    const trackSections = await result.current.getTrackSectionsByIds(['VA', 'VB']);

    expect(postInfraByInfraIdObjectsAndObjectType).toHaveBeenCalledWith({
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
    postInfraByInfraIdObjectsAndObjectType.mockResolvedValue({
      data: [trackVAInfraObject, trackVBInfraObject],
    });

    const { result } = renderHookWithStore(() => useCachedTrackSections(infraId));

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
    postInfraByInfraIdObjectsAndObjectType.mockResolvedValue({ data: [trackVAInfraObject] });

    const { result } = renderHookWithStore(() => useCachedTrackSections(infraId));

    const trackSections1 = await result.current.getTrackSectionsByIds(['VA', 'VA']);

    expect(postInfraByInfraIdObjectsAndObjectType).toHaveBeenCalledWith({
      infraId: 3000,
      objectType: 'TrackSection',
      body: ['VA'],
    });

    expect(trackSections1).toEqual({
      VA: trackVA,
    });

    postInfraByInfraIdObjectsAndObjectType.mockResolvedValue({
      data: [trackVAInfraObject, trackVBInfraObject],
    });

    const trackSections2 = await result.current.getTrackSectionsByIds(['VA', 'VB']);

    expect(postInfraByInfraIdObjectsAndObjectType).toHaveBeenCalledWith({
      infraId: 3000,
      objectType: 'TrackSection',
      body: ['VB'],
    });

    expect(trackSections2).toEqual({ VA: trackVA, VB: trackVB });
  });

  it('should not call the API at all once the result is cached', async () => {
    postInfraByInfraIdObjectsAndObjectType.mockResolvedValue({
      data: [trackVAInfraObject, trackVBInfraObject],
    });

    const { result } = renderHookWithStore(() => useCachedTrackSections(infraId));

    await result.current.getTrackSectionsByIds(['VA', 'VB']);
    await result.current.getTrackSectionsByIds(['VB']);
    await result.current.getTrackSectionsByIds(['VB', 'VA']);
    await result.current.getTrackSectionsByIds(['VA']);

    expect(postInfraByInfraIdObjectsAndObjectType).toHaveBeenCalledTimes(1);

    await result.current.getTrackSectionsByIds(['VC']);

    expect(postInfraByInfraIdObjectsAndObjectType).toHaveBeenCalledTimes(2);
  });

  it('should emit errors in the console if the call fails', async () => {
    const someApiError: ApiError = {
      data: {
        type: 'InternalError',
        message: 'Oops! Something crashed.',
        context: {},
      },
      status: 500,
    };
    postInfraByInfraIdObjectsAndObjectType.mockResolvedValue({ error: someApiError });

    const mockedConsoleError = vi.spyOn(console, 'error');
    const { result } = renderHookWithStore(() => useCachedTrackSections(infraId));

    await result.current.getTrackSectionsByIds(['VA']);
    expect(mockedConsoleError).toHaveBeenCalledWith(
      'Failed to fetch track sections:',
      someApiError
    );
  });

  it('should change infraId parameter in queries if changed', async () => {
    postInfraByInfraIdObjectsAndObjectType.mockResolvedValue({ data: [trackVAInfraObject] });

    const { result, rerender } = renderHookWithStore(
      (hookInfraId: number) => useCachedTrackSections(hookInfraId),
      {
        initialProps: 1234,
      }
    );

    await result.current.getTrackSectionsByIds(['VA']);
    expect(postInfraByInfraIdObjectsAndObjectType).toHaveBeenCalledWith({
      infraId: 1234,
      objectType: 'TrackSection',
      body: ['VA'],
    });

    rerender(5678);

    postInfraByInfraIdObjectsAndObjectType.mockResolvedValue({ data: [trackVBInfraObject] });
    await result.current.getTrackSectionsByIds(['VB']);
    expect(postInfraByInfraIdObjectsAndObjectType).toHaveBeenCalledWith({
      infraId: 5678,
      objectType: 'TrackSection',
      body: ['VB'],
    });
  });
});
