import React, { useEffect, useState } from 'react';

import { compact } from 'lodash';
import { useSelector } from 'react-redux';

// TODO TS2: rename ManageTrainSchedulePathProperties and move it to /modules/pathfinding
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import STDCM_REQUEST_STATUS from 'applications/stdcm/consts';
import useStdcm from 'applications/stdcm/hooks/useStdcm';
import StdcmConfig from 'applications/stdcm/views/StdcmConfig';
import StdcmRequestModal from 'applications/stdcm/views/StdcmRequestModal';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import type {
  PathfindingResultSuccess,
  PostV2InfraByInfraIdPathPropertiesApiArg,
} from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfSelectors } from 'common/osrdContext';
import { formatSuggestedOperationalPoints, upsertViasInOPs } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { updateSelectedTrainId, updateSelectedProjection } from 'reducers/osrdsimulation/actions';
import { useAppDispatch } from 'store';

const StdcmViewV1 = () => {
  const dispatch = useAppDispatch();
  const { getPathSteps } = useOsrdConfSelectors();
  const infraId = useInfraID();
  const pathSteps = useSelector(getPathSteps);

  const [pathProperties, setPathProperties] = useState<ManageTrainSchedulePathProperties>();

  const [postPathProperties] =
    enhancedEditoastApi.endpoints.postV2InfraByInfraIdPathProperties.useMutation();

  const {
    stdcmResults,
    stdcmV2Results,
    launchStdcmRequest,
    currentStdcmRequestStatus,
    cancelStdcmRequest,
  } = useStdcm();

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

        const updatedSuggestedOPs = upsertViasInOPs(
          suggestedOperationalPoints,
          pathStepsWihPosition
        );

        setPathProperties({
          electrifications,
          geometry,
          suggestedOperationalPoints: updatedSuggestedOPs,
          allVias: updatedSuggestedOPs,
          length: path.length,
        });
      }
    };

    if (infraId && stdcmV2Results) {
      const { path } = stdcmV2Results;
      getPathProperties(infraId, path);
    }
  }, [stdcmV2Results]);

  useEffect(
    () => () => {
      dispatch(updateSelectedTrainId(undefined));
      dispatch(updateSelectedProjection(undefined));
    },
    []
  );

  return (
    <>
      <StdcmConfig
        currentStdcmRequestStatus={currentStdcmRequestStatus}
        launchStdcmRequest={launchStdcmRequest}
        stdcmResults={stdcmResults}
        stdcmV2Results={stdcmV2Results}
        pathProperties={pathProperties}
        setPathProperties={setPathProperties}
      />
      {currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending && (
        <StdcmRequestModal
          isOpen={currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending}
          cancelStdcmRequest={cancelStdcmRequest}
        />
      )}
    </>
  );
};

export default StdcmViewV1;
