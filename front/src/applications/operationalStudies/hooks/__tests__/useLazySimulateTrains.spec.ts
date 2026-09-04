import { act, waitFor } from '@testing-library/react';
import { renderHookWithStore } from 'store/__tests__';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TrainSimulationLazyLoader from 'applications/operationalStudies/helpers/TrainSimulationLazyLoader';
import type {
  LightRollingStockWithLiveries,
  PacedTrainException,
  TrainScheduleResponse,
  TrainScheduleSimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import { mockOsrdEditoastEndpoints } from 'common/api/__mocks__/osrdEditoastApi';
import { Duration } from 'utils/duration';

import useLazySimulateTrains, { type UseLazySimulateTrainsOptions } from '../useLazySimulateTrains';

const { postTrainSchedulesSimulationSummary } = mockOsrdEditoastEndpoints;

let onProgress: ((results: Map<number, TrainScheduleSimulationSummaryResult>) => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
});

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

  const mockOnProgress = vi.fn();
  const baseOptions: UseLazySimulateTrainsOptions = {
    infraId: 1,
    timetableId: 1,
    timetableType: 'CALENDAR',
    electricalProfileSetId: 1,
    rollingStocks: [],
    onProgress: mockOnProgress,
  };

  describe('simulateTrainSchedules', () => {
    it('should simulate train schedules by their IDs', async () => {
      postTrainSchedulesSimulationSummary.mockResolvedValue({
        data: { [mockTrain.id]: mockSimulationSummaryResult },
      });

      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));

      act(() => {
        result.current.simulateTrainSchedules([mockTrain]);
      });

      await waitFor(() => {
        expect(result.current.simulatedTrainsById.size).not.toBe(0);
      });

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

  /*
  describe('removeSimulatedTrainSchedules', () => {
    it('should remove simulated train schedules by their IDs', () => {
      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));
      postTrainSchedulesSimulationSummary.mockResolvedValue({
        data: { [mockTrain.id]: mockSimulationSummaryResult },
      });
      act(() => {
        result.current.simulateTrainSchedules([mockTrain]);
      });

      expect(result.current.simulatedTrainsById.size).toBe(1);

      act(() => {
        result.current.removeSimulatedTrainSchedules([mockTrain.id]);
      });

      expect(result.current.simulatedTrainsById.size).toBe(0);
    });

    it('should only remove the specified train and keep the others', () => {
      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));
      act(() => {
        result.current.simulateTrainSchedules([mockTrain, mockTrain2]);
      });
      act(() => {
        onProgress?.(
          new Map([
            [mockTrain.id, mockSimulationSummaryResult],
            [mockTrain2.id, mockSimulationSummaryResult],
          ])
        );
      });

      act(() => {
        result.current.removeSimulatedTrainSchedules([mockTrain.id]);
      });

      expect(result.current.simulatedTrainsById.has(mockTrain.id)).toBe(false);
      expect(result.current.simulatedTrainsById.has(mockTrain2.id)).toBe(true);
    });
  });

  describe('updateProjectedTrainScheduleDepartureTime', () => {
    it('should update the departure time in the simulated trains map', () => {
      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));
      act(() => {
        result.current.simulateTrainSchedules([mockTrain]);
      });
      act(() => {
        onProgress?.(new Map([[mockTrain.id, mockSimulationSummaryResult]]));
      });

      const newDeparture = new Date(2000, 1, 1);
      act(() => {
        result.current.updateSimulatedTrainScheduleDepartureTime(mockTrain.id, newDeparture);
      });
      expect(result.current.simulatedTrainsById.get(mockTrain.id)?.startTime).toEqual(newDeparture);
    });

    it('should update departure time and apply shifted exceptions when provided', () => {
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
      act(() => {
        onProgress?.(new Map([[mockTrain.id, mockSimulationSummaryResult]]));
      });

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

  describe('isTrainSimulationLoading', () => {
    it('should return false if there are no trains to simulate', () => {
      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));

      act(() => {
        onProgress?.(new Map());
      });

      expect(result.current.isTrainSimulationLoading).toBe(false);
    });

    it('should return true if some trains are being simulated', () => {
      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));
      const loaderInstance = vi.mocked(TrainSimulationLazyLoader).mock.results[0].value;
      loaderInstance.pending = [1];
      act(() => {
        onProgress?.(new Map());
      });
      expect(result.current.isTrainSimulationLoading).toBe(true);
    });

    it('should return true if we simulate some train', () => {
      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));

      act(() => {
        result.current.simulateTrainSchedules([mockTrain]);
      });

      expect(result.current.isTrainSimulationLoading).toBe(true);
    });

    it('should return false if no more train is being simulated', () => {
      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));
      const loaderInstance = vi.mocked(TrainSimulationLazyLoader).mock.results[0].value;
      loaderInstance.pending = [1];
      act(() => {
        onProgress?.(new Map());
      });
      expect(result.current.isTrainSimulationLoading).toBe(true);
      loaderInstance.pending = [];
      act(() => {
        onProgress?.(new Map());
      });
      expect(result.current.isTrainSimulationLoading).toBe(false);
    });
  });

  describe('updateSimulatedTrainExceptions', () => {
    it('should update exceptions for paced trains', () => {
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
      act(() => {
        onProgress?.(
          new Map([
            [
              mockTrain.id,
              {
                ...mockSimulationSummaryResult,
                paced: {
                  timeWindow: new Duration({}),
                  interval: new Duration({}),
                  exceptions: [mockTrainException],
                },
              },
            ],
          ])
        );
      });

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

    it('should ignore changes if mock Train is not paced', () => {
      const { result } = renderHookWithStore(() => useLazySimulateTrains(baseOptions));

      act(() => {
        result.current.simulateTrainSchedules([mockTrain]);
      });

      act(() => {
        onProgress?.(new Map([[mockTrain.id, mockSimulationSummaryResult]]));
      });

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
      const mockCancel = vi.mocked(TrainSimulationLazyLoader).mock.results[0].value.cancel;
      unmount();
      expect(mockCancel).toHaveBeenCalled();
    });

    it('should cancel the loader when infraId changes', () => {
      const { rerender } = renderHookWithStore(
        ({ infraId }) => useLazySimulateTrains({ ...baseOptions, infraId }),
        { initialProps: { infraId: 1 } }
      );
      const mockCancel = vi.mocked(TrainSimulationLazyLoader).mock.results[0].value.cancel;
      act(() => {
        rerender({ infraId: 2 });
      });
      expect(mockCancel).toHaveBeenCalled();
    });

    it('should cancel the loader when electricalProfileSetId changes', () => {
      const { rerender } = renderHookWithStore(
        ({ electricalProfileSetId }) =>
          useLazySimulateTrains({ ...baseOptions, electricalProfileSetId }),
        { initialProps: { electricalProfileSetId: 1 } }
      );
      const mockCancel = vi.mocked(TrainSimulationLazyLoader).mock.results[0].value.cancel;
      act(() => {
        rerender({ electricalProfileSetId: 2 });
      });
      expect(mockCancel).toHaveBeenCalled();
    });

    it('should cancel the loader when rollingStocks change', () => {
      const { rerender } = renderHookWithStore(
        ({ rollingStocks }) => useLazySimulateTrains({ ...baseOptions, rollingStocks }),
        { initialProps: { rollingStocks: [] as LightRollingStockWithLiveries[] | null } }
      );
      const mockCancel = vi.mocked(TrainSimulationLazyLoader).mock.results[0].value.cancel;
      act(() => {
        rerender({ rollingStocks: null });
      });
      expect(mockCancel).toHaveBeenCalled();
    });
  });
  */
});
