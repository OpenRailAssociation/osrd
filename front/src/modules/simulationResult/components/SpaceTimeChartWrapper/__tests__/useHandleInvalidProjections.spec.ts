import { renderHook } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { isSimulated } from 'applications/operationalStudies/utils';
import type { PacedTrainException } from 'common/api/osrdEditoastApi';
import type { BaseTrainProjection, TrainSpaceTimeData } from 'modules/simulationResult/types';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { Duration } from 'utils/duration';

import useHandleInvalidProjections from '../useHandleInvalidProjections';

vi.mock('react-redux', () => ({
  useSelector: vi.fn(),
}));

vi.mock('applications/operationalStudies/utils', () => ({
  isSimulated: vi.fn(),
}));

const mockUseSelector = vi.mocked(useSelector);
const mockIsSimulated = vi.mocked(isSimulated);

const baseProjection: TrainSpaceTimeData = {
  id: 1,
  name: 'Train 1',
  departureTime: new Date('2024-01-01'),
  originPathItem: { key: 'origin' } as TrainSpaceTimeData['originPathItem'],
  destinationPathItem: { key: 'destination' } as TrainSpaceTimeData['destinationPathItem'],
  spaceTimeCurves: [],
  signalUpdates: [],
};

// Use a partial train schedule for testing, only including fields relevant to the hook logic
const baseTrainSchedule = { id: 1, name: 'Train 1' } as TrainScheduleWithDetails;

describe('useHandleInvalidProjections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return projections as is when simulation is disabled', () => {
    mockUseSelector.mockReturnValue(false);
    const projections = [baseProjection];

    const { result } = renderHook(() =>
      useHandleInvalidProjections({ trainSchedulesWithDetails: [], projections })
    );

    expect(result.current).toBe(projections);
  });

  it('should return projection as is when no matching train schedule is found', () => {
    mockUseSelector.mockReturnValue(true);
    const projection = { ...baseProjection, id: 999 };

    const { result } = renderHook(() =>
      useHandleInvalidProjections({
        trainSchedulesWithDetails: [baseTrainSchedule],
        projections: [projection],
      })
    );

    expect(result.current[0]).toBe(projection);
  });

  it.each([
    { isValid: true, label: 'simulated' },
    { isValid: false, label: 'not simulated' },
  ])('should mark the projection as $label based on the train schedule summary', ({ isValid }) => {
    mockUseSelector.mockReturnValue(true);
    mockIsSimulated.mockReturnValue(isValid);

    const { result } = renderHook(() =>
      useHandleInvalidProjections({
        trainSchedulesWithDetails: [baseTrainSchedule],
        projections: [baseProjection],
      })
    );

    expect(result.current[0].isSimulated).toBe(isValid);
  });

  it('should handle multiple projections independently', () => {
    mockUseSelector.mockReturnValue(true);
    // isSimulated is called once per projection; use Once to return different values per call
    mockIsSimulated.mockReturnValueOnce(true).mockReturnValueOnce(false);

    const { result } = renderHook(() =>
      useHandleInvalidProjections({
        trainSchedulesWithDetails: [{ ...baseTrainSchedule }, { ...baseTrainSchedule, id: 2 }],
        projections: [{ ...baseProjection }, { ...baseProjection, id: 2 }],
      })
    );

    expect(result.current[0].isSimulated).toBe(true);
    expect(result.current[1].isSimulated).toBe(false);
  });

  describe('paced train exception projections', () => {
    const exceptionId = 42;
    const exceptionProjection: BaseTrainProjection = { spaceTimeCurves: [], signalUpdates: [] };
    const pacedException: PacedTrainException = { key: exceptionId.toString(), id: exceptionId };

    const projectionWithPaced: TrainSpaceTimeData = {
      ...baseProjection,
      paced: {
        timeWindow: Duration.zero,
        interval: Duration.zero,
        exceptions: [],
        exceptionProjections: new Map([[exceptionId, exceptionProjection]]),
      },
    };

    const trainScheduleWithPaced = {
      ...baseTrainSchedule,
      paced: {
        timeWindow: Duration.zero,
        interval: Duration.zero,
        exceptions: [pacedException],
      },
    } as TrainScheduleWithDetails;

    it('should update isSimulated on matching exception projections', () => {
      mockUseSelector.mockReturnValue(true);
      mockIsSimulated.mockReturnValueOnce(true).mockReturnValueOnce(false);

      const { result } = renderHook(() =>
        useHandleInvalidProjections({
          trainSchedulesWithDetails: [trainScheduleWithPaced],
          projections: [projectionWithPaced],
        })
      );

      expect(result.current[0].isSimulated).toBe(true);
      expect(result.current[0].paced?.exceptionProjections.get(exceptionId)?.isSimulated).toBe(
        false
      );
    });

    describe('when the exception id is not in the projection map', () => {
      const trainSchedule = {
        ...baseTrainSchedule,
        paced: {
          timeWindow: Duration.zero,
          interval: Duration.zero,
          exceptions: [{ key: '999', id: 999 }],
        },
      } as TrainScheduleWithDetails;

      it('should not update exception projections', () => {
        mockUseSelector.mockReturnValue(true);
        mockIsSimulated.mockReturnValue(true);

        const { result } = renderHook(() =>
          useHandleInvalidProjections({
            trainSchedulesWithDetails: [trainSchedule],
            projections: [projectionWithPaced],
          })
        );

        expect(
          result.current[0].paced?.exceptionProjections.get(exceptionId)?.isSimulated
        ).toBeUndefined();
      });
    });

    describe('when the train schedule has no paced field', () => {
      it('should not update exception projections', () => {
        mockUseSelector.mockReturnValue(true);
        mockIsSimulated.mockReturnValue(true);

        const { result } = renderHook(() =>
          useHandleInvalidProjections({
            trainSchedulesWithDetails: [baseTrainSchedule],
            projections: [projectionWithPaced],
          })
        );

        expect(
          result.current[0].paced?.exceptionProjections.get(exceptionId)?.isSimulated
        ).toBeUndefined();
      });
    });
  });
});
