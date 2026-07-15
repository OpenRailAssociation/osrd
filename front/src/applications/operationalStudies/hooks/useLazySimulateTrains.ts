import { useRef, useEffect, useCallback, useState } from 'react';

import type {
  LightRollingStockWithLiveries,
  PacedTrainException,
  TimetableType,
  TrainScheduleSimulationSummaryResult,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import formatTrainScheduleSummaries from 'modules/simulationResult/helpers/formatTrainScheduleSummaries';
import { withPacedExceptions } from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { useAppDispatch } from 'store';

import TrainSimulationLazyLoader from '../helpers/TrainSimulationLazyLoader';

type UseLazySimulateTrainsOptions = {
  infraId: number;
  timetableId: number;
  timetableType: TimetableType;
  electricalProfileSetId: number | undefined;
  rollingStocks: LightRollingStockWithLiveries[] | null;
  onProgress?: (results: Map<number, TrainScheduleWithDetails>) => void;
};

/**
 * Hook to incrementally simulate trains.
 *
 * The returned simulateTrainSchedules() function takes train schedules as
 * input, and adds them to the list of trains which need to be simulated.
 * Eventually, the returned simulatedTrainsById map will be populated with
 * completed simulations for these trains.
 *
 * The returned removeSimulatedTrainSchedules() function drops train schedules
 * from the list of trains which need to be simulated and from the returned
 * simulatedTrainsById map.
 *
 * The onProgress callback can be used to perform an additional action when a
 * batch of train simulations completes, e.g. launch a projection.
 */
export default function useLazySimulateTrains({
  infraId,
  timetableId,
  timetableType,
  electricalProfileSetId,
  rollingStocks,
  onProgress,
}: UseLazySimulateTrainsOptions) {
  const dispatch = useAppDispatch();
  const loaderRef = useRef<TrainSimulationLazyLoader>(null);
  const trainSchedulesByIdRef = useRef<Map<number, TrainScheduleResponse>>(new Map());
  const [simulatedTrainsById, setSimulatedTrainsById] = useState<
    Map<number, TrainScheduleWithDetails>
  >(new Map());
  const [isTrainSimulationLoading, setIsTrainSimulationLoading] = useState(false);

  const onProgressRef = useRef<UseLazySimulateTrainsOptions['onProgress']>(null);
  onProgressRef.current = onProgress;

  useEffect(() => {
    if (!rollingStocks) return undefined;

    const loader = new TrainSimulationLazyLoader({
      dispatch,
      infraId,
      timetableId,
      electricalProfileSetId,
      onProgress: (trainScheduleSummaries: Map<number, TrainScheduleSimulationSummaryResult>) => {
        const summaries = formatTrainScheduleSummaries(
          trainScheduleSummaries,
          trainSchedulesByIdRef.current,
          rollingStocks,
          timetableType
        );
        setSimulatedTrainsById((prev) => new Map([...prev.entries(), ...summaries.entries()]));
        if (onProgressRef.current) onProgressRef.current(summaries);
        setIsTrainSimulationLoading(loader.pending.length !== 0);
      },
    });

    loader.simulateTrainSchedules([...trainSchedulesByIdRef.current.keys()]);

    loaderRef.current = loader;
    return () => {
      loader.cancel();
      loaderRef.current = null;
    };
  }, [infraId, electricalProfileSetId, rollingStocks]);

  const simulateTrainSchedules = useCallback((trainSchedules: TrainScheduleResponse[]) => {
    for (const trainSchedule of trainSchedules) {
      trainSchedulesByIdRef.current.set(trainSchedule.id, trainSchedule);
    }

    if (trainSchedules.length > 0) {
      setIsTrainSimulationLoading(true);
      loaderRef.current?.simulateTrainSchedules(trainSchedules.map(({ id }) => id));
    }
  }, []);

  const removeSimulatedTrainSchedules = useCallback((ids: number[]) => {
    for (const id of ids) {
      trainSchedulesByIdRef.current.delete(id);
    }

    setSimulatedTrainsById((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const updateSimulatedTrainScheduleDepartureTime = useCallback(
    (id: number, newDeparture: Date, shiftedExceptions?: PacedTrainException[]) => {
      setSimulatedTrainsById((prev) => {
        const result = prev.get(id);
        if (!result) {
          return prev;
        }
        const next = new Map(prev);
        next.set(
          id,
          withPacedExceptions({ ...result, startTime: newDeparture }, shiftedExceptions)
        );
        return next;
      });
    },
    []
  );

  const updateSimulatedTrainExceptions = useCallback(
    (trainScheduleId: number, updatedExceptions: PacedTrainException[]) => {
      setSimulatedTrainsById((prev) => {
        const existing = prev.get(trainScheduleId);
        if (!existing?.paced) return prev;
        const next = new Map(prev);
        next.set(trainScheduleId, {
          ...existing,
          paced: { ...existing.paced, exceptions: updatedExceptions },
        });
        return next;
      });
    },
    []
  );

  return {
    simulatedTrainsById,
    simulateTrainSchedules,
    removeSimulatedTrainSchedules,
    updateSimulatedTrainScheduleDepartureTime,
    updateSimulatedTrainExceptions,
    isTrainSimulationLoading,
  };
}
