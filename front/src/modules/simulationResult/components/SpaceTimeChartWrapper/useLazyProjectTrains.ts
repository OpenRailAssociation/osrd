import { useEffect, useState, useCallback, useRef } from 'react';

import { useSelector } from 'react-redux';

import TrainOpProjectionLazyLoader from 'applications/operationalStudies/helpers/TrainOpProjectionLazyLoader';
import type { ProjectionResult } from 'applications/operationalStudies/helpers/TrainProjectionLazyLoaderAbstract';
import type TrainProjectionLazyLoaderAbstract from 'applications/operationalStudies/helpers/TrainProjectionLazyLoaderAbstract';
import TrainTrackProjectionLazyLoader from 'applications/operationalStudies/helpers/TrainTrackProjectionLazyLoader';
import upsertNewProjectedTrains from 'applications/operationalStudies/helpers/upsertNewProjectedTrains';
import type {
  OperationalPointReference,
  CoreTrainPath,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import type { TrainSpaceTimeData } from 'modules/simulationResult/types';
import { getProjectionType, getIsSimulationEnabled } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';

type UseLazyProjectTrainsOptions = {
  infraId: number;
  timetableId: number;
  electricalProfileSetId?: number;
  path?: CoreTrainPath;
  operationalPointDistances?: number[];
  operationalPointReferences?: OperationalPointReference[];
};

const DEFAULT_OP_DISTANCES: number[] = [];
const DEFAULT_OP_REFERENCES: OperationalPointReference[] = [];

const useLazyProjectTrains = ({
  infraId,
  timetableId,
  electricalProfileSetId,
  path,
  operationalPointDistances = DEFAULT_OP_DISTANCES,
  operationalPointReferences = DEFAULT_OP_REFERENCES,
}: UseLazyProjectTrainsOptions) => {
  const dispatch = useAppDispatch();
  const loaderRef = useRef<TrainProjectionLazyLoaderAbstract>(null);
  const trainSchedulesByIdRef = useRef<Map<number, TrainScheduleResponse>>(new Map());
  const [projectedTrainsById, setProjectedTrainsById] = useState<Map<number, TrainSpaceTimeData>>(
    new Map()
  );
  const projectionType = useSelector(getProjectionType);
  const isSimulationEnabled = useSelector(getIsSimulationEnabled);
  const [allTrainsProjected, setAllTrainsProjected] = useState(false);

  const onProgress = useCallback((results: Map<number, ProjectionResult>) => {
    setProjectedTrainsById((prev) =>
      upsertNewProjectedTrains(prev, results, trainSchedulesByIdRef.current)
    );
    setAllTrainsProjected(loaderRef.current === null || loaderRef.current.pending.length === 0);
  }, []);

  useEffect(() => {
    const baseOptions = {
      dispatch,
      infraId,
      timetableId,
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

    loader.projectTrainSchedules([...trainSchedulesByIdRef.current.keys()]);

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

  const projectTrainSchedules = useCallback((trainSchedules: TrainScheduleResponse[]) => {
    for (const trainSchedule of trainSchedules) {
      trainSchedulesByIdRef.current.set(trainSchedule.id, trainSchedule);
    }

    if (trainSchedules.length > 0) {
      setAllTrainsProjected(false);
      loaderRef.current?.projectTrainSchedules(trainSchedules.map(({ id }) => id));
    }
  }, []);

  const removeProjectedTrainSchedules = useCallback((ids: number[]) => {
    for (const id of ids) {
      trainSchedulesByIdRef.current.delete(id);
    }

    setProjectedTrainsById((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const updateProjectedTrainScheduleDepartureTime = useCallback(
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
      // Update the train schedule in the reference map
      // This is necessary to keep the reference up-to-date for future projections
      // and to ensure that the projected trains are correctly updated
      // when the projection type changes
      let trainSchedule = trainSchedulesByIdRef.current.get(id);
      if (trainSchedule) {
        trainSchedule = {
          ...trainSchedule,
          start_time: newDeparture.getTime(),
        };
        trainSchedulesByIdRef.current.set(id, trainSchedule);
      }
    },
    []
  );

  return {
    projectedTrainsById,
    projectTrainSchedules,
    removeProjectedTrainSchedules,
    updateProjectedTrainScheduleDepartureTime,
    allTrainsProjected,
  };
};

export default useLazyProjectTrains;
