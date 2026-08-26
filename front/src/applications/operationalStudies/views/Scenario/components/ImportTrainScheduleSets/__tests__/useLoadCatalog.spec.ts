import { waitFor } from '@testing-library/react';
import { renderHookWithStore } from 'store/__tests__';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { mockOsrdEditoastEndpoints } from 'common/api/__mocks__/osrdEditoastApi';
import type { ApiError } from 'common/api/baseGeneratedApis';
import type { CatalogEntry, GetTrainScheduleSetsApiResponse } from 'common/api/osrdEditoastApi';

import useLoadCatalog from '../useLoadCatalog';

const TIMETABLE_ID = 100;

const { mockUseScenarioContext } = vi.hoisted(() => ({
  mockUseScenarioContext: vi.fn(),
}));

vi.mock('applications/operationalStudies/hooks/useScenarioContext', () => ({
  useScenarioContext: mockUseScenarioContext,
}));

const { getAllCatalogEntries, getTrainScheduleSets, getTimetableByIdTrainScheduleSets } =
  mockOsrdEditoastEndpoints;

const catalogEntryWithTrainScheduleSets: CatalogEntry = { id: 1, name: 'Catalog entry 1' };
const catalogEntryWithoutTrainScheduleSets: CatalogEntry = { id: 2, name: 'Catalog entry 2' };

type TrainScheduleSetItem = GetTrainScheduleSetsApiResponse[number];

const trainScheduleSet1: TrainScheduleSetItem = {
  id: 10,
  catalog_entry_id: catalogEntryWithTrainScheduleSets.id,
  description: 'TrainScheduleSet 1',
  name: 'TrainScheduleSet 1',
  published: true,
  timetable_type: 'CALENDAR',
  train_schedule_count: 5,
};

const trainScheduleSet2: TrainScheduleSetItem = {
  id: 11,
  catalog_entry_id: catalogEntryWithTrainScheduleSets.id,
  description: 'TrainScheduleSet 2',
  name: 'TrainScheduleSet 2',
  published: true,
  timetable_type: 'CALENDAR',
  train_schedule_count: 2,
};

describe('useLoadCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseScenarioContext.mockReturnValue({
      scenario: { timetable_id: TIMETABLE_ID, timetable_type: 'CALENDAR' },
    });

    getAllCatalogEntries.mockResolvedValue({
      data: [catalogEntryWithTrainScheduleSets, catalogEntryWithoutTrainScheduleSets],
    });
    getTimetableByIdTrainScheduleSets.mockResolvedValue({ data: [] });

    getTrainScheduleSets.mockImplementation(({ catalogEntryId }) => {
      if (catalogEntryId === catalogEntryWithTrainScheduleSets.id) {
        return { data: [trainScheduleSet1, trainScheduleSet2] };
      }
      return { data: [] };
    });
  });

  it('should build the catalog and train schedule sets maps, skipping entries with no train schedule set', async () => {
    const { result } = renderHookWithStore(() => useLoadCatalog());

    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(result.current.loading).toBe(false);

    expect(getTrainScheduleSets).toHaveBeenCalledWith({
      catalogEntryId: catalogEntryWithTrainScheduleSets.id,
      published: true,
      timetableType: 'CALENDAR',
    });

    expect(getTrainScheduleSets).toHaveBeenCalledWith({
      catalogEntryId: catalogEntryWithoutTrainScheduleSets.id,
      published: true,
      timetableType: 'CALENDAR',
    });

    // Entry with no train schedule sets should be skipped, so the catalog should only contain the entry with trains
    expect(result.current.data?.catalog.size).toBe(1);

    expect(result.current.data?.catalog.get(catalogEntryWithTrainScheduleSets.id)).toEqual({
      ...catalogEntryWithTrainScheduleSets,
      trainScheduleSetIds: [trainScheduleSet1.id, trainScheduleSet2.id],
    });

    expect(result.current.data?.catalog.has(catalogEntryWithoutTrainScheduleSets.id)).toBe(false);

    expect(result.current.data?.trainScheduleSets.get(trainScheduleSet1.id)).toEqual(
      trainScheduleSet1
    );

    expect(result.current.data?.trainScheduleSets.get(trainScheduleSet2.id)).toEqual(
      trainScheduleSet2
    );

    expect(result.current.error).toBeNull();
  });

  it('should only request train schedule sets matching the timetable type', async () => {
    mockUseScenarioContext.mockReturnValue({
      scenario: { timetable_id: TIMETABLE_ID, timetable_type: 'HOURLY' },
    });

    const { result } = renderHookWithStore(() => useLoadCatalog());

    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(getTrainScheduleSets).toHaveBeenCalledWith({
      catalogEntryId: catalogEntryWithTrainScheduleSets.id,
      published: true,
      timetableType: 'HOURLY',
    });

    expect(getTrainScheduleSets).not.toHaveBeenCalledWith(
      expect.objectContaining({ timetableType: 'CALENDAR' })
    );
  });

  it('should mark train schedule sets already linked to the timetable as already imported', async () => {
    getTimetableByIdTrainScheduleSets.mockResolvedValue({
      data: [
        {
          id: trainScheduleSet1.id,
          catalog_entry_id: catalogEntryWithTrainScheduleSets.id,
          description: 'TrainScheduleSet 1',
          published: true,
          timetable_type: 'CALENDAR',
        },
        {
          id: trainScheduleSet2.id,
          catalog_entry_id: null,
          description: 'TrainScheduleSet 2',
          published: true,
          timetable_type: 'CALENDAR',
        },
      ],
    });

    const { result } = renderHookWithStore(() => useLoadCatalog());

    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(result.current.trainScheduleSetsAlreadyImported.has(trainScheduleSet1.id)).toBe(true);

    expect(result.current.trainScheduleSetsAlreadyImported.has(trainScheduleSet2.id)).toBe(false);
  });

  it('should set an error and stop loading when fetching a train schedule set fails', async () => {
    const someApiError: ApiError = {
      status: 500,
      data: { type: 'InternalError', message: 'Api error', context: {} },
    };
    getTrainScheduleSets.mockResolvedValue({ error: someApiError });

    const { result } = renderHookWithStore(() => useLoadCatalog());

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.loading).toBe(false);

    expect(result.current.error).toEqual(someApiError);

    expect(result.current.data).toBeNull();
  });

  it('should early return if catalogData is undefined', async () => {
    // Never-resolving promise: catalogData stays undefined for the whole test
    getAllCatalogEntries.mockReturnValue(new Promise<never>(() => {}) as never);

    const { result } = renderHookWithStore(() => useLoadCatalog());

    expect(getTrainScheduleSets).not.toHaveBeenCalled();

    expect(result.current.loading).toBe(false);

    expect(result.current.data).toBeNull();
  });
});
