import { useEffect, useState, useCallback, useRef } from 'react';

import TrainProjectionLazyLoader from 'applications/operationalStudies/helpers/TrainProjectionLazyLoader';
import upsertNewProjectedTrains from 'applications/operationalStudies/helpers/upsertNewProjectedTrains';
import type { ProjectPathTrainResult, ProjectPathForm } from 'common/api/osrdEditoastApi';
import type { TrainSpaceTimeData } from 'modules/simulationResult/types';
import type { TimetableItemId, TimetableItem } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

type UseLazyProjectTrainsOptions = {
  infraId: number;
  electricalProfileSetId: number | undefined;
  path: ProjectPathForm['path'] | undefined;
};

const useLazyProjectTrains = ({
  infraId,
  electricalProfileSetId,
  path,
}: UseLazyProjectTrainsOptions) => {
  const dispatch = useAppDispatch();
  const loaderRef = useRef<TrainProjectionLazyLoader>();
  const timetableItemsByIdRef = useRef<Map<TimetableItemId, TimetableItem>>(new Map());
  const [projectedTrainsById, setProjectedTrainsById] = useState<
    Map<TimetableItemId, TrainSpaceTimeData>
  >(new Map());

  useEffect(() => {
    if (!path) return undefined;

    const { blocks, routes, track_section_ranges } = path;
    const loader = new TrainProjectionLazyLoader({
      dispatch,
      infraId,
      path: { blocks, routes, track_section_ranges },
      electricalProfileSetId,
      onProgress: (results: Map<TimetableItemId, ProjectPathTrainResult>) => {
        setProjectedTrainsById((prev) =>
          upsertNewProjectedTrains(prev, results, timetableItemsByIdRef.current)
        );
      },
    });

    loader.projectTimetableItems([...timetableItemsByIdRef.current.keys()]);

    loaderRef.current = loader;
    return () => {
      loader.cancel();
      loaderRef.current = undefined;
    };
  }, [infraId, electricalProfileSetId, path]);

  const projectTimetableItems = useCallback((timetableItems: TimetableItem[]) => {
    for (const timetableItem of timetableItems) {
      timetableItemsByIdRef.current.set(timetableItem.id, timetableItem);
    }

    loaderRef.current?.projectTimetableItems(timetableItems.map(({ id }) => id));
  }, []);

  const removeProjectedTimetableItems = useCallback((ids: TimetableItemId[]) => {
    for (const id of ids) {
      timetableItemsByIdRef.current.delete(id);
    }

    setProjectedTrainsById((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const updateTimetableItemDepartureTime = useCallback(
    (id: TimetableItemId, newDeparture: Date) => {
      setProjectedTrainsById((prev) => {
        const result = prev.get(id);
        if (!result) {
          return prev;
        }
        const next = new Map(prev);
        next.set(id, {
          ...result,
          departureTime: newDeparture,
        });
        return next;
      });
    },
    []
  );

  return {
    projectedTrainsById,
    projectTimetableItems,
    removeProjectedTimetableItems,
    updateTimetableItemDepartureTime,
    allTrainsProjected: Boolean(loaderRef.current && loaderRef.current.pending.length === 0),
  };
};

export default useLazyProjectTrains;
