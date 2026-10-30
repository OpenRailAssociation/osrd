import { act, cleanup } from '@testing-library/react';
import { renderHookWithStore } from 'store/__tests__';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockOsrdEditoastEndpoints } from 'common/api/__mocks__/osrdEditoastApi';
import type {
  OperationalPointReference,
  PacedTrainException,
  ProjectPathTrainScheduleResult,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import { simulationResultsInitialState } from 'reducers/simulationResults';

import useLazyProjectTrains from '../useLazyProjectTrains';

const {
  postTrainSchedulesOccupancyBlocks,
  postTrainSchedulesProjectPath,
  postTrainSchedulesProjectPathOp,
} = mockOsrdEditoastEndpoints;

// TODO: unskip these tests once RTK is updated
describe.skip('useLazyProjectTrains', () => {
  const operationalPointReferences: OperationalPointReference[] = [
    { secondary_code: 'BV', main_code: 'OP1', country_code: 'FR', type: 'domestic' },
    { secondary_code: 'BV', main_code: 'OP2', country_code: 'FR', type: 'domestic' },
  ];

  const mockTrain: TrainScheduleResponse = {
    id: 1,
    rolling_stock_name: 'Fast train',
    constraint_distribution: 'MARECO',
    path: [],
    start_time: 0,
    train_name: 'Train 1',
    train_schedule_set_id: 1,
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

  const baseOptions = {
    infraId: 1,
    timetableId: 1,
    electricalProfileSetId: 1,
    operationalPointDistances: [100, 200],
    operationalPointReferences,
  };

  const mockTrainException: PacedTrainException = {
    id: 1,
    key: 'mockTrainException',
    start_time: {
      value: mockTrain.start_time + 1,
    },
  };

  const mockProjectPathTrainScheduleResult: ProjectPathTrainScheduleResult = {
    exceptions: {},
    train_schedule: [
      {
        positions: [],
        times: [],
      },
    ],
  };

  describe('projectTrainSchedules', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      cleanup();
    });

    it('should project train schedules by their IDs', async () => {
      postTrainSchedulesProjectPathOp.mockResolvedValue({
        data: { [mockTrain.id]: mockProjectPathTrainScheduleResult },
      });

      const { result } = renderHookWithStore(() => useLazyProjectTrains(baseOptions));

      act(() => {
        result.current.projectTrainSchedules([mockTrain]);
      });

      await vi.waitUntil(() => result.current.projectedTrainsById.size > 0);

      expect(postTrainSchedulesProjectPathOp).toHaveBeenCalledWith({
        body: {
          infra_id: 1,
          operational_points_distances: [100, 200],
          operational_points_refs: operationalPointReferences,
          timetable_id: 1,
          train_ids: [mockTrain.id],
          use_simulation: true,
        },
      });
    });
  });
  describe('removeProjectedTrainSchedules', () => {
    it('should remove projected train schedules by their IDs', async () => {
      postTrainSchedulesProjectPathOp.mockResolvedValue({
        data: { [mockTrain.id]: mockProjectPathTrainScheduleResult },
      });

      const { result } = renderHookWithStore(() => useLazyProjectTrains(baseOptions));

      act(() => {
        result.current.projectTrainSchedules([mockTrain]);
      });

      await vi.waitUntil(() => result.current.projectedTrainsById.size > 0);

      act(() => {
        result.current.removeProjectedTrainSchedules([mockTrain.id]);
      });

      expect(result.current.projectedTrainsById.size).toBe(0);
    });

    it('should only remove the specified train and keep the others', async () => {
      postTrainSchedulesProjectPathOp.mockResolvedValue({
        data: {
          [mockTrain.id]: mockProjectPathTrainScheduleResult,
          [mockTrain2.id]: mockProjectPathTrainScheduleResult,
        },
      });

      const { result } = renderHookWithStore(() => useLazyProjectTrains(baseOptions));
      act(() => {
        result.current.projectTrainSchedules([mockTrain, mockTrain2]);
      });

      await vi.waitUntil(() => result.current.projectedTrainsById.size > 0);

      act(() => {
        result.current.removeProjectedTrainSchedules([mockTrain.id]);
      });

      expect(result.current.projectedTrainsById.has(mockTrain.id)).toBe(false);
      expect(result.current.projectedTrainsById.has(mockTrain2.id)).toBe(true);
    });
  });

  describe('updateProjectedTrainScheduleDepartureTime', () => {
    it('should update the departure time in the projected trains map', async () => {
      postTrainSchedulesProjectPathOp.mockResolvedValue({
        data: { [mockTrain.id]: mockProjectPathTrainScheduleResult },
      });

      const { result } = renderHookWithStore(() => useLazyProjectTrains(baseOptions));

      act(() => {
        result.current.projectTrainSchedules([mockTrain]);
      });

      await vi.waitUntil(() => result.current.projectedTrainsById.size > 0);

      const newDeparture = new Date('2024-01-01T12:00:00Z');

      act(() => {
        result.current.updateProjectedTrainScheduleDepartureTime(mockTrain.id, newDeparture);
      });

      expect(result.current.projectedTrainsById.get(mockTrain.id)?.departureTime).toEqual(
        newDeparture
      );
    });

    it('should do nothing if train id is not found in the map', () => {
      const { result } = renderHookWithStore(() => useLazyProjectTrains(baseOptions));

      act(() => {
        result.current.updateProjectedTrainScheduleDepartureTime(
          3,
          new Date('2024-01-01T12:00:00Z')
        );
      });
      expect(result.current.projectedTrainsById.size).toBe(0);
    });

    it('should update the start time in the train schedules ref', async () => {
      postTrainSchedulesProjectPathOp.mockResolvedValue({
        data: { [mockTrain.id]: mockProjectPathTrainScheduleResult },
      });
      const { result, rerender } = renderHookWithStore(
        ({ infraId }) => useLazyProjectTrains({ ...baseOptions, infraId }),
        { initialProps: { infraId: 1 } }
      );
      act(() => {
        result.current.projectTrainSchedules([mockTrain]);
      });

      await vi.waitUntil(() => result.current.projectedTrainsById.size > 0);

      const newDeparture = new Date('2024-01-01T12:00:00Z');
      act(() => {
        result.current.updateProjectedTrainScheduleDepartureTime(mockTrain.id, newDeparture);
      });

      act(() => {
        rerender({ infraId: 2 });
      });

      await vi.waitUntil(() => result.current.projectedTrainsById.size > 0);

      expect(result.current.projectedTrainsById.get(mockTrain.id)?.departureTime).toEqual(
        newDeparture
      );
    });
  });

  describe('allTrainsProjected', () => {
    it('should update according to projections', async () => {
      let resolveProjection!: () => void;
      postTrainSchedulesProjectPathOp.mockReturnValue(
        new Promise((resolve) => {
          resolveProjection = () =>
            resolve({ data: { [mockTrain.id]: mockProjectPathTrainScheduleResult } });
        }) as never
      );

      const { result } = renderHookWithStore(() => useLazyProjectTrains(baseOptions));

      act(() => {
        result.current.projectTrainSchedules([mockTrain]);
      });

      await vi.waitFor(() => {
        expect(result.current.allTrainsProjected).toBe(false);
      });

      await act(async () => {
        resolveProjection();
      });

      await vi.waitFor(() => {
        expect(result.current.allTrainsProjected).toBe(true);
      });
    });
  });

  describe('updateSimulatedTrainExceptions', () => {
    it('should update exceptions for paced trains', async () => {
      postTrainSchedulesProjectPathOp.mockResolvedValue({
        data: {
          [mockTrain.id]: mockProjectPathTrainScheduleResult,
        },
      });

      const { result } = renderHookWithStore(() => useLazyProjectTrains(baseOptions));

      act(() => {
        result.current.projectTrainSchedules([
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

      await vi.waitUntil(() => result.current.projectedTrainsById.size > 0);

      expect(result.current.projectedTrainsById.get(mockTrain.id)?.paced).toBeTruthy();

      act(() => {
        result.current.updateProjectedTrainExceptions(mockTrain.id, [
          {
            ...mockTrainException,
            start_time: {
              value: mockTrainException.start_time!.value + 2,
            },
          },
        ]);
      });

      expect(result.current.projectedTrainsById.get(mockTrain.id)?.paced?.exceptions).toEqual([
        {
          ...mockTrainException,
          start_time: {
            value: mockTrainException.start_time!.value + 2,
          },
        },
      ]);
    });

    it('should ignore changes if mock Train is not paced', async () => {
      postTrainSchedulesProjectPathOp.mockResolvedValue({
        data: {
          [mockTrain.id]: mockProjectPathTrainScheduleResult,
        },
      });

      const { result } = renderHookWithStore(() => useLazyProjectTrains(baseOptions));

      act(() => {
        result.current.projectTrainSchedules([mockTrain]);
      });

      await vi.waitUntil(() => result.current.projectedTrainsById.has(mockTrain.id));

      act(() => {
        result.current.updateProjectedTrainExceptions(mockTrain.id, [
          {
            ...mockTrainException,
            start_time: {
              value: mockTrainException.start_time!.value + 2,
            },
          },
        ]);
      });

      expect(result.current.projectedTrainsById.get(mockTrain.id)?.paced).toBeUndefined();
    });
  });

  describe('loader selection', () => {
    it('should adapt projection method to trackProjection', async () => {
      postTrainSchedulesProjectPath.mockResolvedValue({
        data: { [mockTrain.id]: mockProjectPathTrainScheduleResult },
      });

      postTrainSchedulesOccupancyBlocks.mockResolvedValue({
        data: {
          [mockTrain.id]: {
            exceptions: {},
            train_schedule: [],
          },
        },
      });
      const path = { track_section_ranges: [], blocks: [], routes: [] };
      const { result } = renderHookWithStore(
        () => useLazyProjectTrains({ ...baseOptions, path }),
        {},
        {
          simulation: {
            ...simulationResultsInitialState,
            projectionType: 'trackProjection',
            isSimulationEnabled: true,
          },
        }
      );

      act(() => {
        result.current.projectTrainSchedules([mockTrain]);
      });

      await vi.waitUntil(() => result.current.projectedTrainsById.size > 0);

      expect(postTrainSchedulesProjectPath).toHaveBeenCalled(); // 'trackProjection' => go through postTrainSchedulesProjectPath
    });
  });
});
