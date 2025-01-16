/* eslint-disable no-restricted-syntax, no-await-in-loop */
import { useEffect, useState, type Dispatch, type SetStateAction, useMemo, useRef } from 'react';

import { useSelector } from 'react-redux';

import upsertNewProjectedTrains from 'applications/operationalStudies/helpers/upsertNewProjectedTrains';
import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import {
  osrdEditoastApi,
  type PathfindingResultSuccess,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { getBatchPackage } from 'utils/batch';
import { castErrorToFailure } from 'utils/error';
import { mapBy } from 'utils/types';

const BATCH_SIZE = 5;

type useLazyLoadTrainsProp = {
  infraId?: number;
  trainIdsToProject: Set<number>;
  path?: PathfindingResultSuccess;
  trainSchedules?: TrainScheduleResult[];
  moreTrainsToCome?: boolean;
  setTrainIdsToProject: Dispatch<SetStateAction<Set<number>>>;
};

/**
 * This hook gradually projects trains of the timetable.
 *
 * It projects the trains by batch of 10 on the path.
 * This optimizes the performance of the application and allow us to display the
 * trains on the space time chart as soon as they are ready.
 */
const useLazyProjectTrains = ({
  infraId,
  trainIdsToProject,
  path,
  trainSchedules,
  moreTrainsToCome = false,
  setTrainIdsToProject,
}: useLazyLoadTrainsProp) => {
  const dispatch = useAppDispatch();
  const { getElectricalProfileSetId } = useOsrdConfSelectors();
  const electricalProfileSetId = useSelector(getElectricalProfileSetId);

  const [projectedTrainsById, setProjectedTrainsById] = useState<Map<number, TrainSpaceTimeData>>(
    new Map()
  );

  const allTrainsProjected = useMemo(() => trainIdsToProject.size === 0, [trainIdsToProject]);

  const requestedProjectedTrainIds = useRef<Set<number>>(new Set());
  const projectionSeqNum = useRef(0);

  const [postTrainScheduleProjectPath] =
    osrdEditoastApi.endpoints.postTrainScheduleProjectPath.useLazyQuery();

  const trainSchedulesById = useMemo(() => mapBy(trainSchedules, 'id'), [trainSchedules]);

  // gradually project the trains on the selected path
  useEffect(() => {
    const projectNextPackage = async (
      _path: PathfindingResultSuccess,
      packageToProject: number[]
    ) => {
      packageToProject.forEach((trainId) => requestedProjectedTrainIds.current.add(trainId));

      const { blocks, routes, track_section_ranges } = _path;
      const rawProjectedTrains = await postTrainScheduleProjectPath({
        projectPathForm: {
          infra_id: infraId!,
          ids: packageToProject,
          path: { blocks, routes, track_section_ranges },
          electrical_profile_set_id: electricalProfileSetId,
        },
      }).unwrap();

      setProjectedTrainsById((prevTrains) => {
        const newProjectedTrains = upsertNewProjectedTrains(
          prevTrains,
          rawProjectedTrains,
          trainSchedulesById
        );
        return newProjectedTrains;
      });
    };

    const projectTrains = async (
      seqNum: number,
      _path: PathfindingResultSuccess,
      _trainToProjectIds: Set<number>
    ) => {
      const shouldProjectIds = Array.from(_trainToProjectIds).filter(
        (trainId) => !requestedProjectedTrainIds.current.has(trainId)
      );

      for (let i = 0; i < shouldProjectIds.length; i += BATCH_SIZE) {
        // If projection parameters have changed, bail out
        if (projectionSeqNum.current !== seqNum) break;

        const packageToProject = getBatchPackage(i, shouldProjectIds, BATCH_SIZE);
        try {
          await projectNextPackage(_path, packageToProject);
        } catch (e) {
          console.error('error', e);
          dispatch(setFailure(castErrorToFailure(e)));
        }
      }
    };

    if (infraId && path) {
      projectionSeqNum.current += 1;
      projectTrains(projectionSeqNum.current, path, trainIdsToProject);
    }
  }, [trainIdsToProject]);

  useEffect(() => {
    // reset the state when all the trains have been projected
    if (
      !moreTrainsToCome &&
      trainIdsToProject.size > 0 &&
      requestedProjectedTrainIds.current.size === trainIdsToProject.size
    ) {
      setTrainIdsToProject(new Set());
      requestedProjectedTrainIds.current = new Set();
    }
  }, [moreTrainsToCome, projectedTrainsById]);

  useEffect(() => {
    if (!moreTrainsToCome && trainSchedules && path) {
      // project all the trains again
      projectionSeqNum.current += 1;
      requestedProjectedTrainIds.current = new Set();
      setProjectedTrainsById(new Map());
    }
  }, [path]);

  return {
    allTrainsProjected,
    projectedTrainsById,
    setProjectedTrainsById,
  };
};

export default useLazyProjectTrains;
