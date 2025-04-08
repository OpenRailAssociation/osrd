import { useRef, useEffect, useCallback, useState } from 'react';

import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import type { TimetableItemId, TimetableItemWithTimetableId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import formatTimetableItemSummaries from '../helpers/formatTimetableItemSummaries';
import TrainSimulationLazyLoader from '../helpers/TrainSimulationLazyLoader';

type UseLazySimulateTrainsOptions = {
  infraId: number;
  electricalProfileSetId: number | undefined;
  rollingStocks: LightRollingStockWithLiveries[] | null;
  onProgress?: (results: Map<TimetableItemId, TimetableItemWithDetails>) => void;
};

/**
 * Hook to incrementally simulate trains.
 *
 * The returned simulateTimetableItems() function takes timetable items as
 * input, and adds them to the list of trains which need to be simulated.
 * Eventually, the returned simulatedTrainsById map will be populated with
 * completed simulations for these trains.
 *
 * The returned removeSimulatedTimetableItems() function drops timetable items
 * from the list of trains which need to be simulated and from the returned
 * simulatedTrainsById map.
 *
 * The onProgress callback can be used to perform an additional action when a
 * batch of train simulations completes, e.g. launch a projection.
 */
export default function useLazySimulateTrains({
  infraId,
  electricalProfileSetId,
  rollingStocks,
  onProgress,
}: UseLazySimulateTrainsOptions) {
  const dispatch = useAppDispatch();
  const loaderRef = useRef<TrainSimulationLazyLoader>();
  const timetableItemsByIdRef = useRef<Map<TimetableItemId, TimetableItemWithTimetableId>>(
    new Map()
  );
  const [simulatedTrainsById, setSimulatedTrainsById] = useState<
    Map<TimetableItemId, TimetableItemWithDetails>
  >(new Map());

  useEffect(() => {
    if (!rollingStocks) return undefined;

    const loader = new TrainSimulationLazyLoader({
      dispatch,
      infraId,
      electricalProfileSetId,
      onProgress: (rawSummaries: Map<TimetableItemId, SimulationSummaryResult>) => {
        const summaries = formatTimetableItemSummaries(
          [...rawSummaries.keys()],
          rawSummaries,
          timetableItemsByIdRef.current,
          rollingStocks
        );
        setSimulatedTrainsById((prev) => new Map([...prev.entries(), ...summaries.entries()]));
        if (onProgress) onProgress(summaries);
      },
    });

    loader.simulateTimetableItems([...timetableItemsByIdRef.current.keys()]);

    loaderRef.current = loader;
    return () => {
      loader.cancel();
      loaderRef.current = undefined;
    };
  }, [infraId, electricalProfileSetId, rollingStocks]);

  const simulateTimetableItems = useCallback((timetableItems: TimetableItemWithTimetableId[]) => {
    for (const timetableItem of timetableItems) {
      timetableItemsByIdRef.current.set(timetableItem.id, timetableItem);
    }

    loaderRef.current?.simulateTimetableItems(timetableItems.map(({ id }) => id));
  }, []);

  const removeSimulatedTimetableItems = useCallback((ids: TimetableItemId[]) => {
    for (const id of ids) {
      timetableItemsByIdRef.current.delete(id);
    }

    setSimulatedTrainsById((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        next.delete(id);
      }
      return next;
    });
  }, []);

  return {
    simulatedTrainsById,
    simulateTimetableItems,
    removeSimulatedTimetableItems,
    allTrainsSimulated: loaderRef.current && loaderRef.current.pending.length === 0,
  };
}
