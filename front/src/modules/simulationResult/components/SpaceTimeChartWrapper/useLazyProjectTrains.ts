import { useEffect, useState, useCallback, useRef } from 'react';

import { useSelector } from 'react-redux';

import TrainOpProjectionLazyLoader from 'applications/operationalStudies/helpers/TrainOpProjectionLazyLoader';
import type { ProjectionResult } from 'applications/operationalStudies/helpers/TrainProjectionLazyLoaderAbstract';
import type TrainProjectionLazyLoaderAbstract from 'applications/operationalStudies/helpers/TrainProjectionLazyLoaderAbstract';
import TrainTrackProjectionLazyLoader from 'applications/operationalStudies/helpers/TrainTrackProjectionLazyLoader';
import upsertNewProjectedTrains from 'applications/operationalStudies/helpers/upsertNewProjectedTrains';
import { type OperationalPointReference, type CoreTrainPath } from 'common/api/osrdEditoastApi';
import type { TrainSpaceTimeData } from 'modules/simulationResult/types';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { getProjectionType, getIsSimulationEnabled } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';

type UseLazyProjectTrainsOptions = {
  infraId: number;
  electricalProfileSetId?: number;
  path?: CoreTrainPath;
  operationalPointDistances?: number[];
  operationalPointReferences?: OperationalPointReference[];
};

const useLazyProjectTrains = ({
  infraId,
  electricalProfileSetId,
  path,
  operationalPointDistances = [],
  operationalPointReferences = [],
}: UseLazyProjectTrainsOptions) => {
  const dispatch = useAppDispatch();
  const loaderRef = useRef<TrainProjectionLazyLoaderAbstract>(null);
  const timetableItemsByIdRef = useRef<Map<number, TimetableItem>>(new Map());
  const [projectedTrainsById, setProjectedTrainsById] = useState<Map<number, TrainSpaceTimeData>>(
    new Map()
  );
  const projectionType = useSelector(getProjectionType);
  const isSimulationEnabled = useSelector(getIsSimulationEnabled);

  const onProgress = useCallback((results: Map<number, ProjectionResult>) => {
    setProjectedTrainsById((prev) =>
      upsertNewProjectedTrains(prev, results, timetableItemsByIdRef.current)
    );
  }, []);

  useEffect(() => {
    const baseOptions = {
      dispatch,
      infraId,
      electricalProfileSetId,
      onProgress,
    };

    let loader: TrainProjectionLazyLoaderAbstract;

    if (isSimulationEnabled && projectionType === 'trackProjection' && path) {
      loader = new TrainTrackProjectionLazyLoader({
        ...baseOptions,
        path,
      });
    } else {
      if (operationalPointReferences.length < 2) return;

      loader = new TrainOpProjectionLazyLoader(
        operationalPointReferences,
        operationalPointDistances,
        { ...baseOptions, path, isSimulationEnabled }
      );
    }

    loader.projectTimetableItems([...timetableItemsByIdRef.current.keys()]);

    loaderRef.current = loader;
    return () => {
      loader.cancel();
      loaderRef.current = null;
    };
  }, [
    infraId,
    electricalProfileSetId,
    projectionType,
    path,
    operationalPointReferences,
    operationalPointDistances,
    isSimulationEnabled,
  ]);

  const projectTimetableItems = useCallback((timetableItems: TimetableItem[]) => {
    for (const timetableItem of timetableItems) {
      timetableItemsByIdRef.current.set(timetableItem.id, timetableItem);
    }

    loaderRef.current?.projectTimetableItems(timetableItems.map(({ id }) => id));
  }, []);

  const removeProjectedTimetableItems = useCallback((ids: number[]) => {
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
    (id: number, newDeparture: Date) => {
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
