import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getMode } from 'reducers/osrdconf/selectors';
import { updateSelectedTrainId, updateSelectedProjection } from 'reducers/osrdsimulation/actions';
import { MODES } from 'applications/operationalStudies/consts';
import STDCM_REQUEST_STATUS from 'applications/stdcm/consts';
import { StdcmRequestStatus } from 'applications/stdcm/types';
import { updateMode } from 'reducers/osrdconf';
import OSRDStdcmConfig from './OSRDStdcmConfig';
import StdcmRequestModal from './StdcmRequestModal';

export default function OSRDSTDCM() {
  const dispatch = useDispatch();
  const mode = useSelector(getMode);
  const [currentStdcmRequestStatus, setCurrentStdcmRequestStatus] = useState<StdcmRequestStatus>(
    STDCM_REQUEST_STATUS.idle
  );
  useEffect(() => {
    if (mode !== MODES.stdcm) dispatch(updateMode(MODES.stdcm));
    return () => {
      dispatch(updateMode(MODES.simulation));
      dispatch(updateSelectedTrainId(undefined));
      dispatch(updateSelectedProjection(undefined));
    };
  }, []);

  return (
    <>
      <OSRDStdcmConfig
        currentStdcmRequestStatus={currentStdcmRequestStatus}
        setCurrentStdcmRequestStatus={setCurrentStdcmRequestStatus}
      />
      {currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending && (
        <StdcmRequestModal
          setCurrentStdcmRequestStatus={setCurrentStdcmRequestStatus}
          currentStdcmRequestStatus={currentStdcmRequestStatus}
        />
      )}
    </>
  );
}
