import { act } from '@testing-library/react';
import { renderHookWithStore } from 'store/__tests__';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TrainOpProjectionLazyLoader from 'applications/operationalStudies/helpers/TrainOpProjectionLazyLoader';
import type { ProjectionResult } from 'applications/operationalStudies/helpers/TrainProjectionLazyLoaderAbstract';
import TrainTrackProjectionLazyLoader from 'applications/operationalStudies/helpers/TrainTrackProjectionLazyLoader';
import type { OperationalPointReference, TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { simulationResultsInitialState } from 'reducers/simulationResults';

import useLazyProjectTrains from '../useLazyProjectTrains';

let onProgress: ((results: Map<number, ProjectionResult>) => void) | undefined;

const { mockProjectTrainSchedules } = vi.hoisted(() => ({
  mockProjectTrainSchedules: vi.fn(),
}));

vi.mock('applications/operationalStudies/helpers/upsertNewProjectedTrains', () => ({
  default: vi.fn((prev, results: Map<number, unknown>) => {
    const next = new Map(prev);
    results.forEach((value: unknown, key: number) => next.set(key, value));
    return next;
  }),
}));

vi.mock('applications/operationalStudies/helpers/TrainOpProjectionLazyLoader', () => ({
  default: vi.fn(
    class {
      projectTrainSchedules = mockProjectTrainSchedules;
      cancel = vi.fn();
      pending = [];
      constructor(
        _operationalPointReferences: OperationalPointReference[],
        _operationalPointDistances: number[],
        options: { onProgress: (results: Map<number, ProjectionResult>) => void }
      ) {
        onProgress = options.onProgress;
      }
    }
  ),
}));

vi.mock('applications/operationalStudies/helpers/TrainTrackProjectionLazyLoader', () => ({
  default: vi.fn(
    class {
      projectTrainSchedules = mockProjectTrainSchedules;
    }
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useLazyProjectTrains', () => {
  const operationalPointReferences: OperationalPointReference[] = [
    { secondary_code: 'BV', trigram: 'OP1', type: 'trigram' },
    { secondary_code: 'BV', trigram: 'OP2', type: 'trigram' },
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

  const base = {
    infraId: 1,
    timetableId: 1,
    electricalProfileSetId: 1,
    operationalPointDistances: [100, 200],
    operationalPointReferences,
  };

  describe('projectTrainSchedules', () => {
    it('should project train schedules by their IDs', () => {
      const { result } = renderHookWithStore(() => useLazyProjectTrains(base));
      result.current.projectTrainSchedules([mockTrain]);
      expect(mockProjectTrainSchedules).toHaveBeenCalledWith([mockTrain.id]);
    });
  });

  describe('removeProjectedTrainSchedules', () => {
    it('should remove projected train schedules by their IDs', () => {
      const { result } = renderHookWithStore(() => useLazyProjectTrains(base));
      act(() => {
        onProgress?.(
          new Map([
            [
              mockTrain.id,
              { departureTime: new Date(mockTrain.start_time), space_time_curves: [] },
            ],
          ])
        );
      });
      act(() => {
        result.current.removeProjectedTrainSchedules([mockTrain.id]);
      });
      expect(result.current.projectedTrainsById.size).toBe(0);
    });

    it('should only remove the specified train and keep the others', () => {
      const { result } = renderHookWithStore(() => useLazyProjectTrains(base));

      act(() => {
        onProgress?.(
          new Map([
            [
              mockTrain.id,
              { departureTime: new Date(mockTrain.start_time), space_time_curves: [] },
            ],
            [
              mockTrain2.id,
              { departureTime: new Date(mockTrain2.start_time), space_time_curves: [] },
            ],
          ])
        );
      });
      act(() => {
        result.current.removeProjectedTrainSchedules([mockTrain.id]);
      });
      expect(result.current.projectedTrainsById.has(mockTrain.id)).toBe(false);
      expect(result.current.projectedTrainsById.has(mockTrain2.id)).toBe(true);
    });
  });

  describe('updateProjectedTrainScheduleDepartureTime', () => {
    it('should update the departure time in the projected trains map', () => {
      const { result } = renderHookWithStore(() => useLazyProjectTrains(base));

      act(() => {
        onProgress?.(
          new Map([
            [
              mockTrain.id,
              { departureTime: new Date(mockTrain.start_time), space_time_curves: [] },
            ],
          ])
        );
      });
      const newDeparture = new Date('2024-01-01T12:00:00Z');
      act(() => {
        result.current.updateProjectedTrainScheduleDepartureTime(mockTrain.id, newDeparture);
      });
      expect(result.current.projectedTrainsById.get(mockTrain.id)?.departureTime).toEqual(
        newDeparture
      );
    });

    it('should do nothing if train id is not found in the map', () => {
      const { result } = renderHookWithStore(() => useLazyProjectTrains(base));

      act(() => {
        result.current.updateProjectedTrainScheduleDepartureTime(
          3,
          new Date('2024-01-01T12:00:00Z')
        );
      });
      expect(result.current.projectedTrainsById.size).toBe(0);
    });

    it('should update the start time in the train schedules ref', () => {
      const { result, rerender } = renderHookWithStore(
        ({ infraId }) => useLazyProjectTrains({ ...base, infraId }),
        { initialProps: { infraId: 1 } }
      );
      act(() => {
        result.current.projectTrainSchedules([mockTrain]);
      });
      act(() => {
        onProgress?.(
          new Map([
            [
              mockTrain.id,
              { departureTime: new Date(mockTrain.start_time), space_time_curves: [] },
            ],
          ])
        );
      });

      const newDeparture = new Date('2024-01-01T12:00:00Z');
      act(() => {
        result.current.updateProjectedTrainScheduleDepartureTime(mockTrain.id, newDeparture);
      });

      act(() => {
        rerender({ infraId: 2 });
      });

      expect(mockProjectTrainSchedules).toHaveBeenLastCalledWith([mockTrain.id]);
    });
  });

  describe('loader selection', () => {
    it('should use TrainTrackProjectionLazyLoader when projectionType is trackProjection', () => {
      renderHookWithStore(
        () =>
          useLazyProjectTrains({
            ...base,
            path: { track_section_ranges: [], blocks: [], routes: [] },
          }),
        {},
        {
          simulation: {
            ...simulationResultsInitialState,
            projectionType: 'trackProjection',
            isSimulationEnabled: true,
          },
        }
      );

      expect(vi.mocked(TrainTrackProjectionLazyLoader).mock.instances.length).toBe(1);
      expect(vi.mocked(TrainOpProjectionLazyLoader).mock.instances.length).toBe(0);
    });

    it('should not create a loader when there are less than 2 operationalPointReferences', () => {
      renderHookWithStore(
        () =>
          useLazyProjectTrains({
            ...base,
            operationalPointReferences: [{ secondary_code: 'BV', trigram: 'OP1', type: 'trigram' }],
          }),
        {}
      );
      expect(vi.mocked(TrainOpProjectionLazyLoader).mock.instances.length).toBe(0);
      expect(vi.mocked(TrainTrackProjectionLazyLoader).mock.instances.length).toBe(0);
    });
  });

  describe('allTrainsProjected', () => {
    it('should return true if all trains are projected', () => {
      const { result } = renderHookWithStore(() => useLazyProjectTrains(base));

      act(() => {
        onProgress?.(new Map());
      });

      expect(result.current.allTrainsProjected).toBe(true);
    });

    it('should return false if not all trains are projected', () => {
      const { result } = renderHookWithStore(() => useLazyProjectTrains(base));
      const loaderInstance = vi.mocked(TrainOpProjectionLazyLoader).mock.results[0].value;
      loaderInstance.pending = [1];
      expect(result.current.allTrainsProjected).toBe(false);
    });

    it('should return false if we project train schedules', () => {
      const { result } = renderHookWithStore(() => useLazyProjectTrains(base));

      act(() => {
        result.current.projectTrainSchedules([mockTrain]);
      });

      expect(result.current.allTrainsProjected).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cancel the loader when the component unmounts', () => {
      const { unmount } = renderHookWithStore(() => useLazyProjectTrains(base));
      const mockCancel = vi.mocked(TrainOpProjectionLazyLoader).mock.results[0].value.cancel;
      unmount();
      expect(mockCancel).toHaveBeenCalled();
    });

    it('should cancel the loader when a dependency changes', () => {
      const { rerender } = renderHookWithStore(
        ({ infraId }) => useLazyProjectTrains({ ...base, infraId }),
        { initialProps: { infraId: 1 } }
      );
      const mockCancel = vi.mocked(TrainOpProjectionLazyLoader).mock.results[0].value.cancel;
      act(() => {
        rerender({ infraId: 2 });
      });
      expect(mockCancel).toHaveBeenCalled();
    });

    it('should cancel the loader when timetableId changes', () => {
      const { rerender } = renderHookWithStore(
        ({ timetableId }) => useLazyProjectTrains({ ...base, timetableId }),
        { initialProps: { timetableId: 1 } }
      );
      const mockCancel = vi.mocked(TrainOpProjectionLazyLoader).mock.results[0].value.cancel;
      act(() => {
        rerender({ timetableId: 2 });
      });
      expect(mockCancel).toHaveBeenCalled();
    });
  });
});
