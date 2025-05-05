/* eslint-disable no-restricted-syntax, no-await-in-loop */
import { useEffect, useState, type Dispatch, type SetStateAction, useMemo, useRef } from 'react';

import upsertNewProjectedTrains from 'applications/operationalStudies/helpers/upsertNewProjectedTrains';
import {
  osrdEditoastApi,
  type PathfindingResultSuccess,
  type ProjectPathTrainResult,
} from 'common/api/osrdEditoastApi';
import type { TrainSpaceTimeData } from 'modules/simulationResult/types';
import { setFailure } from 'reducers/main';
import type { TimetableItemId, TimetableItemWithTimetableId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { getBatchPackage } from 'utils/batch';
import { castErrorToFailure } from 'utils/error';
import {
  formatEditoastIdToTrainScheduleId,
  formatTrainScheduleIdToEditoastTrainId,
  formatPacedTrainIdToEditoastTrainId,
  isTrainScheduleId,
  formatEditoastIdToPacedTrainId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

const BATCH_SIZE = 5;

type useLazyLoadTrainsParams = {
  infraId?: number;
  electricalProfileSetId: number | undefined;
  timetableItemIdsToProject: Set<TimetableItemId>;
  path?: PathfindingResultSuccess;
  timetableItems?: TimetableItemWithTimetableId[];
  moreTrainsToCome?: boolean;
  setTimetableItemIdsToProject: Dispatch<SetStateAction<Set<TimetableItemId>>>;
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
  electricalProfileSetId,
  timetableItemIdsToProject,
  path,
  timetableItems,
  moreTrainsToCome = false,
  setTimetableItemIdsToProject,
}: useLazyLoadTrainsParams) => {
  const dispatch = useAppDispatch();

  const [projectedTrainsById, setProjectedTrainsById] = useState<
    Map<TimetableItemId, TrainSpaceTimeData>
  >(new Map());

  const allTrainsProjected = useMemo(
    () => timetableItemIdsToProject.size === 0,
    [timetableItemIdsToProject]
  );

  const requestedProjectedTrainIds = useRef<Set<TimetableItemId>>(new Set());
  const projectionSeqNum = useRef(0);

  const [postTrainScheduleProjectPath] =
    osrdEditoastApi.endpoints.postTrainScheduleProjectPath.useLazyQuery();

  const [postPacedTrainProjectPath] =
    osrdEditoastApi.endpoints.postPacedTrainProjectPath.useLazyQuery();

  const trainSchedulesById = useMemo(() => mapBy(timetableItems, 'id'), [timetableItems]);

  // gradually project the trains on the selected path
  useEffect(() => {
    const projectNextPackage = async (
      _path: PathfindingResultSuccess,
      packageToProject: TimetableItemId[]
    ) => {
      packageToProject.forEach((trainId) => requestedProjectedTrainIds.current.add(trainId));

      // Format train ids back to editoast format
      const { editoastTrainIds, editoastPacedTrainIds } = packageToProject.reduce<{
        editoastTrainIds: number[];
        editoastPacedTrainIds: number[];
      }>(
        (acc, trainId) => {
          if (isTrainScheduleId(trainId)) {
            acc.editoastTrainIds.push(formatTrainScheduleIdToEditoastTrainId(trainId));
          } else {
            acc.editoastPacedTrainIds.push(formatPacedTrainIdToEditoastTrainId(trainId));
          }
          return acc;
        },
        { editoastTrainIds: [], editoastPacedTrainIds: [] }
      );

      const { blocks, routes, track_section_ranges } = _path;
      const rawProjectedTrains = await postTrainScheduleProjectPath({
        projectPathForm: {
          infra_id: infraId!,
          ids: editoastTrainIds,
          path: { blocks, routes, track_section_ranges },
          electrical_profile_set_id: electricalProfileSetId,
        },
      }).unwrap();

      const rawProjectedPacedTrains = await postPacedTrainProjectPath({
        projectPathForm: {
          infra_id: infraId!,
          ids: editoastPacedTrainIds,
          path: { blocks, routes, track_section_ranges },
          electrical_profile_set_id: electricalProfileSetId,
        },
      }).unwrap();

      const formattedRawProjectedTrains: Map<TimetableItemId, ProjectPathTrainResult> = new Map();
      for (const [editoastTrainId, projectedTrain] of Object.entries(rawProjectedTrains)) {
        const trainId = formatEditoastIdToTrainScheduleId(Number(editoastTrainId));
        formattedRawProjectedTrains.set(trainId, projectedTrain);
      }

      for (const [editoastTrainId, projectedTrain] of Object.entries(rawProjectedPacedTrains)) {
        const trainId = formatEditoastIdToPacedTrainId(Number(editoastTrainId));
        formattedRawProjectedTrains.set(trainId, projectedTrain);
      }

      setProjectedTrainsById((prevTrains) => {
        const newProjectedTrains = upsertNewProjectedTrains(
          prevTrains,
          formattedRawProjectedTrains,
          trainSchedulesById
        );
        return newProjectedTrains;
      });
    };

    const projectTrains = async (
      seqNum: number,
      _path: PathfindingResultSuccess,
      _trainToProjectIds: Set<TimetableItemId>
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
      projectTrains(projectionSeqNum.current, path, timetableItemIdsToProject);
    }
  }, [timetableItemIdsToProject]);

  useEffect(() => {
    // reset the state when all the trains have been projected
    if (
      !moreTrainsToCome &&
      timetableItemIdsToProject.size > 0 &&
      requestedProjectedTrainIds.current.size === timetableItemIdsToProject.size
    ) {
      setTimetableItemIdsToProject(new Set());
      requestedProjectedTrainIds.current = new Set();
    }
  }, [moreTrainsToCome, projectedTrainsById]);

  useEffect(() => {
    if (!moreTrainsToCome && timetableItems && path) {
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
