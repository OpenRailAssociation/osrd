import { useEffect, useMemo } from 'react';

// TODO TS2: rename ManageTrainSchedulePathProperties and move it to /modules/pathfinding
import { STDCM_REQUEST_STATUS } from 'applications/stdcm/consts';
import useStdcm from 'applications/stdcm/hooks/useStdcm';
import StdcmConfig from 'applications/stdcm/views/StdcmConfig';
import StdcmRequestModal from 'applications/stdcm/views/StdcmRequestModal';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';

import useProjectedTrainsForStdcm from '../hooks/useProjectedTrainsForStdcm';
import type { StdcmV2Results } from '../types';

const StdcmViewV1 = () => {
  const dispatch = useAppDispatch();

  const {
    stdcmV2Results,
    launchStdcmRequest,
    currentStdcmRequestStatus,
    cancelStdcmRequest,
    pathProperties,
    setPathProperties,
  } = useStdcm();

  const spaceTimeData = useProjectedTrainsForStdcm(stdcmV2Results?.stdcmResponse);

  const stdcmResult: StdcmV2Results | null = useMemo(
    () => (stdcmV2Results ? { ...stdcmV2Results, spaceTimeData } : null),
    [stdcmV2Results, spaceTimeData]
  );

  useEffect(
    () => () => {
      dispatch(updateSelectedTrainId(undefined));
    },
    []
  );

  return (
    <>
      <StdcmConfig
        currentStdcmRequestStatus={currentStdcmRequestStatus}
        launchStdcmRequest={launchStdcmRequest}
        stdcmV2Results={stdcmResult}
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
