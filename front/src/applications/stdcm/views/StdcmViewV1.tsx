import React, { useEffect } from 'react';

// TODO TS2: rename ManageTrainSchedulePathProperties and move it to /modules/pathfinding
import { STDCM_REQUEST_STATUS } from 'applications/stdcm/consts';
import useStdcm from 'applications/stdcm/hooks/useStdcm';
import StdcmConfig from 'applications/stdcm/views/StdcmConfig';
import StdcmRequestModal from 'applications/stdcm/views/StdcmRequestModal';
import { updateSelectedTrainId, updateSelectedProjection } from 'reducers/osrdsimulation/actions';
import { useAppDispatch } from 'store';

const StdcmViewV1 = () => {
  const dispatch = useAppDispatch();

  const {
    stdcmResults,
    stdcmV2Results,
    launchStdcmRequest,
    currentStdcmRequestStatus,
    cancelStdcmRequest,
    pathProperties,
    setPathProperties,
  } = useStdcm();

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
