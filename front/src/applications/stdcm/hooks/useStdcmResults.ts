import { useEffect, useMemo, useState } from 'react';

import { compact, keyBy } from 'lodash';
import { useSelector } from 'react-redux';

import type {
  ManageTrainSchedulePathProperties,
  TrainSpaceTimeData,
} from 'applications/operationalStudies/types';
import type { StdcmV2Results, StdcmV2SuccessResponse } from 'applications/stdcm/types';
import {
  osrdEditoastApi,
  type PathfindingResultSuccess,
  type PostV2InfraByInfraIdPathPropertiesApiArg,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfSelectors } from 'common/osrdContext';
import { formatSuggestedOperationalPoints, upsertPathStepsInOPs } from 'modules/pathfinding/utils';
import formatTrainsIntoSpaceTimeData from 'modules/simulationResult/components/SpaceTimeChart/formatSpaceTimeData';
import useSpeedSpaceChart from 'modules/simulationResult/components/SpeedSpaceChart/useSpeedSpaceChart';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { updateSelectedTrainId } from 'reducers/osrdsimulation/actions';
import { getSelectedTrainId } from 'reducers/osrdsimulation/selectors';
import { useAppDispatch } from 'store';

import { STDCM_TRAIN_ID } from '../consts';
import formatStdcmTrainIntoSpaceTimeData from '../utils/formatStdcmIntoSpaceTimeData';

const useStdcmResults = (
  stdcmResponse: StdcmV2SuccessResponse | undefined,
  stdcmTrainResult: TrainScheduleResult | undefined,
  setPathProperties: (pathProperties?: ManageTrainSchedulePathProperties) => void
): StdcmV2Results | null => {
  const dispatch = useAppDispatch();
  const infraId = useInfraID();
  const { getPathSteps, getTimetableID } = useOsrdConfSelectors();
  const pathSteps = useSelector(getPathSteps);
  const timetableId = useSelector(getTimetableID);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const [spaceTimeData, setSpaceTimeData] = useState<TrainSpaceTimeData[]>([]);

  const speedSpaceChartData = useSpeedSpaceChart(
    stdcmTrainResult,
    stdcmResponse?.path,
    stdcmResponse?.simulation,
    stdcmResponse?.departure_time
  );

  const [postPathProperties] =
    osrdEditoastApi.endpoints.postV2InfraByInfraIdPathProperties.useMutation();
  const [projectTrainSchedules] =
    osrdEditoastApi.endpoints.postV2TrainScheduleProjectPath.useMutation();

  const { data: otherSelectedTrainSchedule } =
    osrdEditoastApi.endpoints.getV2TrainScheduleById.useQuery(
      {
        id: selectedTrainId as number,
      },
      { skip: !selectedTrainId || selectedTrainId === STDCM_TRAIN_ID }
    );

  const { data: timetable } = osrdEditoastApi.endpoints.getV2TimetableById.useQuery(
    { id: timetableId! },
    {
      skip: !timetableId,
    }
  );

  const { currentData: trainSchedules } = osrdEditoastApi.endpoints.postV2TrainSchedule.useQuery(
    {
      body: {
        ids: timetable?.train_ids as number[],
      },
    },
    {
      skip: !timetable || !timetable.train_ids.length,
    }
  );

  const selectedTrainSchedule = useMemo(
    () =>
      selectedTrainId !== STDCM_TRAIN_ID && otherSelectedTrainSchedule
        ? otherSelectedTrainSchedule
        : stdcmTrainResult,
    [selectedTrainId, stdcmTrainResult, otherSelectedTrainSchedule]
  );

  useEffect(() => {
    const getPathProperties = async (_infraId: number, path: PathfindingResultSuccess) => {
      const pathPropertiesParams: PostV2InfraByInfraIdPathPropertiesApiArg = {
        infraId: _infraId,
        props: ['electrifications', 'geometry', 'operational_points'],
        pathPropertiesInput: {
          track_section_ranges: path.track_section_ranges,
        },
      };
      const { geometry, operational_points, electrifications } =
        await postPathProperties(pathPropertiesParams).unwrap();

      if (geometry && operational_points && electrifications) {
        const pathStepsWihPosition = compact(pathSteps).map((step, i) => ({
          ...step,
          positionOnPath: path.path_items_positions[i],
        }));

        const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
          operational_points,
          geometry,
          path.length
        );

        const updatedSuggestedOPs = upsertPathStepsInOPs(
          suggestedOperationalPoints,
          pathStepsWihPosition
        );

        setPathProperties({
          electrifications,
          geometry,
          suggestedOperationalPoints: updatedSuggestedOPs,
          allWaypoints: updatedSuggestedOPs,
          length: path.length,
          trackSectionRanges: path.track_section_ranges,
        });
      }
    };

    if (infraId && stdcmResponse) {
      const { path } = stdcmResponse;
      getPathProperties(infraId, path);
    }
  }, [stdcmResponse]);

  useEffect(() => {
    const getSpaceTimeChartData = async (
      _infraId: number,
      path: PathfindingResultSuccess,
      trainSchedulesIds: number[],
      stdcmSimulation: StdcmV2SuccessResponse['simulation'],
      stdcmDepartureTime: string,
      stdcmRollingStockLength: number
    ) => {
      const { blocks, routes, track_section_ranges } = path;
      const projectPathTrainResult = await projectTrainSchedules({
        projectPathForm: {
          infra_id: _infraId,
          ids: trainSchedulesIds,
          path: { blocks, routes, track_section_ranges },
        },
      }).unwrap();

      const newSpaceTimeData = formatTrainsIntoSpaceTimeData(
        projectPathTrainResult,
        keyBy(trainSchedules, 'id')
      );

      const stdcmProjectedTrain = formatStdcmTrainIntoSpaceTimeData(
        stdcmSimulation,
        stdcmDepartureTime,
        stdcmRollingStockLength
      );

      newSpaceTimeData.push(stdcmProjectedTrain);
      setSpaceTimeData(newSpaceTimeData);
    };

    if (infraId && stdcmResponse && timetable) {
      const { path } = stdcmResponse;
      getSpaceTimeChartData(
        infraId,
        path,
        timetable.train_ids,
        stdcmResponse.simulation,
        stdcmResponse.departure_time,
        stdcmResponse.rollingStock.length
      );
    }
  }, [stdcmResponse]);

  if (!infraId || !stdcmResponse || !selectedTrainSchedule) return null;

  return {
    stdcmResponse,
    spaceTimeData,
    selectedTrainSchedule,
    infraId,
    dispatchUpdateSelectedTrainId: (_selectedTrainId: number) => {
      dispatch(updateSelectedTrainId(_selectedTrainId));
    },
    setSpaceTimeData,
    speedSpaceChartData,
  };
};

export default useStdcmResults;
