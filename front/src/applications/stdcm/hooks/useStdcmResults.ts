import { useEffect, useMemo } from 'react';

import { compact } from 'lodash';
import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { StdcmV2SuccessResponse } from 'applications/stdcm/types';
import {
  osrdEditoastApi,
  type PathfindingResultSuccess,
  type PostV2InfraByInfraIdPathPropertiesApiArg,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfSelectors } from 'common/osrdContext';
import { formatSuggestedOperationalPoints, upsertPathStepsInOPs } from 'modules/pathfinding/utils';
import useSpeedSpaceChart from 'modules/simulationResult/components/SpeedSpaceChart/useSpeedSpaceChart';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { getSelectedTrainId } from 'reducers/osrdsimulation/selectors';

import { STDCM_TRAIN_ID } from '../consts';

const useStdcmResults = (
  stdcmResponse: StdcmV2SuccessResponse | undefined,
  stdcmTrainResult: TrainScheduleResult | undefined,
  setPathProperties: (pathProperties?: ManageTrainSchedulePathProperties) => void
) => {
  const infraId = useInfraID();
  const { getPathSteps } = useOsrdConfSelectors();
  const pathSteps = useSelector(getPathSteps);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const [postPathProperties] =
    osrdEditoastApi.endpoints.postV2InfraByInfraIdPathProperties.useMutation();

  const { data: otherSelectedTrainSchedule } =
    osrdEditoastApi.endpoints.getV2TrainScheduleById.useQuery(
      {
        id: selectedTrainId as number,
      },
      { skip: !selectedTrainId || selectedTrainId === STDCM_TRAIN_ID }
    );

  const selectedTrainSchedule = useMemo(
    () =>
      selectedTrainId !== STDCM_TRAIN_ID && otherSelectedTrainSchedule
        ? otherSelectedTrainSchedule
        : stdcmTrainResult,
    [selectedTrainId, stdcmTrainResult, otherSelectedTrainSchedule]
  );

  const speedSpaceChartData = useSpeedSpaceChart(
    stdcmTrainResult,
    stdcmResponse?.path,
    stdcmResponse?.simulation,
    stdcmResponse?.departure_time
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
          positionOnPath: path.path_item_positions[i],
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
          manchetteOperationalPoints: operational_points,
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

  if (!infraId || !stdcmResponse || !selectedTrainSchedule) return null;

  return {
    stdcmResponse,
    speedSpaceChartData,
  };
};

export default useStdcmResults;
