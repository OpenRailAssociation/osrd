import { useEffect, useState, useCallback, useRef } from 'react';

import { useSelector } from 'react-redux';

import TrainOpProjectionLazyLoader from 'applications/operationalStudies/helpers/TrainOpProjectionLazyLoader';
import type { ProjectionResult } from 'applications/operationalStudies/helpers/TrainProjectionLazyLoaderAbstract';
import type TrainProjectionLazyLoaderAbstract from 'applications/operationalStudies/helpers/TrainProjectionLazyLoaderAbstract';
import TrainTrackProjectionLazyLoader from 'applications/operationalStudies/helpers/TrainTrackProjectionLazyLoader';
import upsertNewProjectedTrains from 'applications/operationalStudies/helpers/upsertNewProjectedTrains';
import {
  type OperationalPointReference,
  type PathfindingResultSuccess,
  type PathProperties,
} from 'common/api/osrdEditoastApi';
import type { TrainSpaceTimeData } from 'modules/simulationResult/types';
import type { TimetableItemId, TimetableItem } from 'reducers/osrdconf/types';
import { getProjectionType } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';

type UseLazyProjectTrainsOptions = {
  infraId: number;
  electricalProfileSetId?: number;
  path?: PathfindingResultSuccess;
  operationalPoints?: PathProperties['operational_points'];
};

const useLazyProjectTrains = ({
  infraId,
  electricalProfileSetId,
  path,
  operationalPoints,
}: UseLazyProjectTrainsOptions) => {
  const dispatch = useAppDispatch();
  const loaderRef = useRef<TrainProjectionLazyLoaderAbstract>(null);
  const timetableItemsByIdRef = useRef<Map<TimetableItemId, TimetableItem>>(new Map());
  const [projectedTrainsById, setProjectedTrainsById] = useState<
    Map<TimetableItemId, TrainSpaceTimeData>
  >(new Map());
  const projectionType = useSelector(getProjectionType);

  const onProgress = useCallback((results: Map<TimetableItemId, ProjectionResult>) => {
    setProjectedTrainsById((prev) =>
      upsertNewProjectedTrains(prev, results, timetableItemsByIdRef.current)
    );
  }, []);

  useEffect(() => {
    if (!path) return undefined;
    const opRefs: OperationalPointReference[] = [];
    const opDistances: number[] = [];
    const options = {
      dispatch,
      infraId,
      pathfindingResult: path,
      electricalProfileSetId,
      onProgress,
    };

    if (!operationalPoints || operationalPoints.length === 0) return;
    operationalPoints.forEach(({ id, position }, index) => {
      opRefs.push({ operational_point: id });
      if (index > 0) {
        opDistances.push(position - operationalPoints[index - 1].position);
      }
    });

    const loader =
      projectionType === 'trackProjection'
        ? new TrainTrackProjectionLazyLoader(options)
        : new TrainOpProjectionLazyLoader(opRefs, opDistances, options);

    loader.projectTimetableItems([...timetableItemsByIdRef.current.keys()]);

    loaderRef.current = loader;
    return () => {
      loader.cancel();
      loaderRef.current = null;
    };
  }, [infraId, electricalProfileSetId, path, projectionType, operationalPoints]);

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

  const updateProjectedTimetableItemDepartureTime = useCallback(
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
      // Update the timetable item in the reference map
      // This is necessary to keep the reference up-to-date for future projections
      // and to ensure that the projected trains are correctly updated
      // when the projection type changes
      const timetableItem = timetableItemsByIdRef.current.get(id);
      if (timetableItem) {
        timetableItem.start_time = newDeparture.toISOString();
      }
    },
    []
  );

  return {
    projectedTrainsById,
    projectTimetableItems,
    removeProjectedTimetableItems,
    updateProjectedTimetableItemDepartureTime,
    allTrainsProjected: Boolean(loaderRef.current && loaderRef.current.pending.length === 0),
  };
};

export default useLazyProjectTrains;
