import { act } from '@testing-library/react';
import { renderHookWithStore } from 'store/__tests__';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import TrainSimulationLazyLoader from 'applications/operationalStudies/helpers/TrainSimulationLazyLoader';
import { mockOsrdEditoastEndpoints } from 'common/api/__mocks__/osrdEditoastApi';
import type {
  LightRollingStockWithLiveries,
  PacedTrainException,
  TrainScheduleResponse,
  TrainScheduleSimulationSummaryResult,
} from 'common/api/osrdEditoastApi';

import useLazySimulateTrains, { type UseLazySimulateTrainsOptions } from '../useLazySimulateTrains';

const { postTrainSchedulesSimulationSummary } = mockOsrdEditoastEndpoints;

describe('useLazySimulateTrains', () => {
  const mockTrain: TrainScheduleResponse = {
    id: 1,
    rolling_stock_name: 'Fast train',
    constraint_distribution: 'MARECO',
    path: [],
    start_time: 0,
    train_name: 'Train 1',
    train_schedule_set_id: 1,
  };

  const mockTrainException: PacedTrainException = {
    id: 1,
    key: 'mockTrainException',
    start_time: {
      value: mockTrain.start_time + 1,
    },
  };

  const mockSimulationSummaryResult: TrainScheduleSimulationSummaryResult = {
    exceptions: {},
    train_schedule: {
      energy_consumption: 100,
      length: 4000000,
      path_item_respect_margins: [],
      path_item_respect_times: [],
      path_item_times_base: [],
      path_item_times_final: [],
      path_item_times_provisional: [],
      status: 'success',
      time: 30,
    },
  };

  const mockTrain2: TrainScheduleResponse = {
    id: 2,
    rolling_stock_name: 'Fast train 2',
    constraint_distribution: 'MARECO',
    path: [],
    start_time: 0,
    train_name: 'Train 2',
    train_schedule_set_id: 1,
  };

  const baseOptions: UseLazySimulateTrainsOptions = {
    infraId: 1,
    timetableId: 1,
    timetableType: 'CALENDAR',
    electricalProfileSetId: 1,
    rollingStocks: [],
    onProgress: () => {},
  };

  let spyOnCancel: MockInstance;
  let spyOnLazyLoaderSimulation: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    spyOnCancel = vi.spyOn(TrainSimulationLazyLoader.prototype, 'cancel');
    spyOnLazyLoaderSimulation = vi.spyOn(
      TrainSimulationLazyLoader.prototype,
      'simulateTrainSchedules'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('simulateTrainSchedules', () => {
    it('should simulate train schedules by their IDs', async () => {
      postTrainSchedulesSimulationSummary.mockResolvedValue({
        data: { [mockTrain.id]: mockSimulationSummaryResult },
      });

      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));

      act(() => {
        result.current.simulateTrainSchedules([mockTrain]);
      });

      await vi.waitUntil(() => result.current.simulatedTrainsById.size > 0);

      expect(postTrainSchedulesSimulationSummary).toHaveBeenCalledWith({
        body: {
          electrical_profile_set_id: 1,
          ids: [mockTrain.id],
          infra_id: 1,
          timetable_id: 1,
        },
      });
    });
  });

  describe('removeSimulatedTrainSchedules', async () => {
    it('should remove simulated train schedules by their IDs', async () => {
      postTrainSchedulesSimulationSummary.mockResolvedValue({
        data: { [mockTrain.id]: mockSimulationSummaryResult },
      });

      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));
      act(() => {
        result.current.simulateTrainSchedules([mockTrain]);
      });

      await vi.waitUntil(() => result.current.simulatedTrainsById.size > 0);

      act(() => {
        result.current.removeSimulatedTrainSchedules([mockTrain.id]);
      });

      expect(result.current.simulatedTrainsById.size).toBe(0);
    });

    it('should only remove the specified train and keep the others', async () => {
      postTrainSchedulesSimulationSummary.mockResolvedValue({
        data: {
          [mockTrain.id]: mockSimulationSummaryResult,
          [mockTrain2.id]: mockSimulationSummaryResult,
        },
      });

      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));
      act(() => {
        result.current.simulateTrainSchedules([mockTrain, mockTrain2]);
      });

      await vi.waitUntil(() => result.current.simulatedTrainsById.size > 0);

      act(() => {
        result.current.removeSimulatedTrainSchedules([mockTrain.id]);
      });

      expect(result.current.simulatedTrainsById.has(mockTrain.id)).toBe(false);
      expect(result.current.simulatedTrainsById.has(mockTrain2.id)).toBe(true);
    });
  });

  describe('updateProjectedTrainScheduleDepartureTime', () => {
    it('should update the departure time in the simulated trains map', async () => {
      postTrainSchedulesSimulationSummary.mockResolvedValue({
        data: { [mockTrain.id]: mockSimulationSummaryResult },
      });

      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));
      act(() => {
        result.current.simulateTrainSchedules([mockTrain]);
      });

      await vi.waitUntil(() => result.current.simulatedTrainsById.size > 0);

      const newDeparture = new Date(2000, 1, 1);
      act(() => {
        result.current.updateSimulatedTrainScheduleDepartureTime(mockTrain.id, newDeparture);
      });
      expect(result.current.simulatedTrainsById.get(mockTrain.id)?.startTime).toEqual(newDeparture);
    });

    it('should update departure time and apply shifted exceptions when provided', async () => {
      postTrainSchedulesSimulationSummary.mockResolvedValue({
        data: { [mockTrain.id]: mockSimulationSummaryResult },
      });

      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));
      act(() => {
        result.current.simulateTrainSchedules([
          {
            ...mockTrain,
            paced: {
              time_window: 'PT1S',
              interval: 'PT1S',
              exceptions: [],
            },
          },
        ]);
      });

      await vi.waitUntil(() => result.current.simulatedTrainsById.size > 0);

      const newDeparture = new Date(2000, 1, 1);
      act(() => {
        result.current.updateSimulatedTrainScheduleDepartureTime(mockTrain.id, newDeparture, [
          mockTrainException,
        ]);
      });
      expect(result.current.simulatedTrainsById.get(mockTrain.id)?.startTime).toEqual(newDeparture);
      expect(result.current.simulatedTrainsById.get(mockTrain.id)?.paced?.exceptions).toEqual([
        mockTrainException,
      ]);
    });

    it('should do nothing if train id is not found in the map', () => {
      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));

      act(() => {
        result.current.updateSimulatedTrainScheduleDepartureTime(3, new Date(2000, 1, 1));
      });
      expect(result.current.simulatedTrainsById.size).toBe(0);
    });
  });

  describe('loader selection', () => {
    it('should use create the loader when rolling stocks are available', () => {
      renderHookWithStore(() => useLazySimulateTrains(baseOptions));

      expect(spyOnLazyLoaderSimulation).toHaveBeenCalledTimes(1);
    });

    it('should not create a loader when there are no rolling stocks list', () => {
      renderHookWithStore(
        () =>
          useLazySimulateTrains({
            ...baseOptions,
            rollingStocks: null,
          }),
        {}
      );

      expect(spyOnLazyLoaderSimulation).not.toHaveBeenCalled();
    });
  });

  describe('isTrainSimulationLoading', () => {
    it('should return false if there are no trains to simulate', () => {
      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));

      expect(result.current.isTrainSimulationLoading).toBe(false);
    });

    it('should return true if some trains are being simulated', async () => {
      postTrainSchedulesSimulationSummary.mockResolvedValue({
        data: { [mockTrain.id]: mockSimulationSummaryResult },
      });

      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));

      act(() => {
        result.current.simulateTrainSchedules([mockTrain]);
      });

      await vi.waitFor(() => {
        expect(result.current.isTrainSimulationLoading).toBe(true);
      });
    });

    it('should return false if train simulations are done', async () => {
      postTrainSchedulesSimulationSummary.mockResolvedValue({
        data: { [mockTrain.id]: mockSimulationSummaryResult },
      });

      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));

      act(() => {
        result.current.simulateTrainSchedules([mockTrain]);
      });

      await vi.waitFor(() => {
        expect(result.current.isTrainSimulationLoading).toBe(true);
      });

      await vi.waitFor(() => {
        expect(result.current.isTrainSimulationLoading).toBe(false);
      });
    });
  });

  describe('updateSimulatedTrainExceptions', () => {
    it('should update exceptions for paced trains', async () => {
      postTrainSchedulesSimulationSummary.mockResolvedValue({
        data: {
          [mockTrain.id]: {
            ...mockSimulationSummaryResult,
          },
        },
      });

      const { result } = renderHookWithStore(() =>
        useLazySimulateTrains({
          ...baseOptions,
          rollingStocks: [{ name: mockTrain.rolling_stock_name } as LightRollingStockWithLiveries],
        })
      );
      act(() => {
        result.current.simulateTrainSchedules([
          {
            ...mockTrain,
            paced: {
              time_window: 'PT1S',
              interval: 'PT1S',
              exceptions: [mockTrainException],
            },
          },
        ]);
      });

      await vi.waitUntil(() => result.current.simulatedTrainsById.get(mockTrain.id)?.paced);

      act(() => {
        result.current.updateSimulatedTrainExceptions(mockTrain.id, [
          {
            ...mockTrainException,
            start_time: {
              value: mockTrainException.start_time!.value + 2,
            },
          },
        ]);
      });

      expect(result.current.simulatedTrainsById.get(mockTrain.id)?.paced?.exceptions).toEqual([
        {
          ...mockTrainException,
          start_time: {
            value: mockTrainException.start_time!.value + 2,
          },
        },
      ]);
    });

    it('should ignore changes if mock Train is not paced', async () => {
      postTrainSchedulesSimulationSummary.mockResolvedValue({
        data: {
          [mockTrain.id]: {
            ...mockSimulationSummaryResult,
          },
        },
      });

      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));

      act(() => {
        result.current.simulateTrainSchedules([mockTrain]);
      });

      await vi.waitUntil(() => result.current.simulatedTrainsById.has(mockTrain.id));

      act(() => {
        result.current.updateSimulatedTrainExceptions(mockTrain.id, [
          {
            ...mockTrainException,
            start_time: {
              value: mockTrainException.start_time!.value + 2,
            },
          },
        ]);
      });

      expect(result.current.simulatedTrainsById.get(mockTrain.id)?.paced).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should cancel the loader when the component unmounts', () => {
      const { unmount } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));

      unmount();
      expect(spyOnCancel).toHaveBeenCalled();
    });

    it('should cancel the loader when infraId changes', () => {
      const { rerender } = renderHookWithStore(
        ({ infraId }) => useLazySimulateTrains({ ...baseOptions, infraId }),
        { initialProps: { infraId: 1 } }
      );

      act(() => {
        rerender({ infraId: 2 });
      });
      expect(spyOnCancel).toHaveBeenCalled();
    });

    it('should cancel the loader when electricalProfileSetId changes', () => {
      const { rerender } = renderHookWithStore(
        ({ electricalProfileSetId }) =>
          useLazySimulateTrains({ ...baseOptions, electricalProfileSetId }),
        { initialProps: { electricalProfileSetId: 1 } }
      );

      act(() => {
        rerender({ electricalProfileSetId: 2 });
      });
      expect(spyOnCancel).toHaveBeenCalled();
    });

    it('should cancel the loader when rollingStocks change', () => {
      const { rerender } = renderHookWithStore(
        ({ rollingStocks }) => useLazySimulateTrains({ ...baseOptions, rollingStocks }),
        { initialProps: { rollingStocks: [] as LightRollingStockWithLiveries[] | null } }
      );

      act(() => {
        rerender({ rollingStocks: null });
      });
      expect(spyOnCancel).toHaveBeenCalled();
    });
  });
});
