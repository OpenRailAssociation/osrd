import { useEffect, useMemo } from 'react';

import { compact } from 'lodash';
import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { StdcmSuccessResponse } from 'applications/stdcm/types';
import {
  osrdEditoastApi,
  type PathfindingResultSuccess,
  type PostInfraByInfraIdPathPropertiesApiArg,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfSelectors } from 'common/osrdContext';
import { formatSuggestedOperationalPoints, upsertPathStepsInOPs } from 'modules/pathfinding/utils';
import useSpeedSpaceChart from 'modules/simulationResult/components/SpeedSpaceChart/useSpeedSpaceChart';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';

import { STDCM_TRAIN_ID } from '../consts';

const useStdcmResults = (
  stdcmResponse: StdcmSuccessResponse | undefined,
  stdcmTrainResult: TrainScheduleResult | undefined,
  setPathProperties: (pathProperties?: ManageTrainSchedulePathProperties) => void
) => {
  const infraId = useInfraID();
  const { getPathSteps } = useOsrdConfSelectors();
  const pathSteps = useSelector(getPathSteps);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useMutation();

  const { data: otherSelectedTrainSchedule } =
    osrdEditoastApi.endpoints.getTrainScheduleById.useQuery(
      {
        id: selectedTrainId!,
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
      const pathPropertiesParams: PostInfraByInfraIdPathPropertiesApiArg = {
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

        const operationalPointsWithUniqueIds = operational_points.map((op, index) => ({
          ...op,
          id: `${op.id}-${op.position}-${index}`,
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
          manchetteOperationalPoints: operationalPointsWithUniqueIds,
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
