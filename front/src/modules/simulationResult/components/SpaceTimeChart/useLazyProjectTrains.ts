/* eslint-disable no-restricted-syntax, no-await-in-loop */
import { useEffect, useState, useMemo, useRef } from 'react';

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

const BATCH_SIZE = 10;

type useLazyLoadTrainsProp = {
  infraId?: number;
  path?: PathfindingResultSuccess;
  trainSchedules?: TrainScheduleResult[];
  moreTrainsToCome?: boolean;
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
  path,
  trainSchedules,
  moreTrainsToCome = false,
}: useLazyLoadTrainsProp) => {
  const dispatch = useAppDispatch();
  const { getElectricalProfileSetId } = useOsrdConfSelectors();
  const electricalProfileSetId = useSelector(getElectricalProfileSetId);

  const [trainIdsToProject, setTrainIdsToProject] = useState<number[]>([]);

  const [projectedTrainsById, setProjectedTrainsById] = useState<Map<number, TrainSpaceTimeData>>(
    new Map()
  );

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

      setProjectedTrainsById((prevTrains) =>
        upsertNewProjectedTrains(prevTrains, rawProjectedTrains, trainSchedulesById)
      );
    };

    const projectTrains = async (
      seqNum: number,
      _path: PathfindingResultSuccess,
      _trainToProjectIds: number[]
    ) => {
      const shouldProjectIds = _trainToProjectIds.filter(
        (trainId) => !requestedProjectedTrainIds.current.has(trainId)
      );

      for (let i = 0; i < shouldProjectIds.length; i += BATCH_SIZE) {
        // If projection parameters have changed, bail out
        if (projectionSeqNum.current !== seqNum) return;

        const packageToProject = getBatchPackage(i, shouldProjectIds, BATCH_SIZE);
        try {
          await projectNextPackage(_path, packageToProject);
        } catch (e) {
          console.error('error', e);
          dispatch(setFailure(castErrorToFailure(e)));
        }
      }

      requestedProjectedTrainIds.current = new Set();
      setTrainIdsToProject([]);
    };

    if (infraId && path && trainIdsToProject.length > 0) {
      projectionSeqNum.current += 1;
      projectTrains(projectionSeqNum.current, path, trainIdsToProject);
    }
  }, [trainIdsToProject]);

  useEffect(() => {
    if (!moreTrainsToCome && trainSchedules && path) {
      // project all the trains again
      projectionSeqNum.current += 1;
      requestedProjectedTrainIds.current = new Set();
      setProjectedTrainsById(new Map());

      const trainIds = trainSchedules.map((trainSchedule) => trainSchedule.id);
      setTrainIdsToProject(trainIds);
    }
  }, [path]);

  const projectTrains = (trainIds: number[]) => {
    setTrainIdsToProject((prev) => [...prev, ...trainIds]);
  };

  return {
    projectedTrainsById,
    setProjectedTrainsById,
    projectTrains,
  };
};

export default useLazyProjectTrains;
