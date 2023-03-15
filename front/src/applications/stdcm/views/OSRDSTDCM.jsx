import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getMode } from 'reducers/osrdconf/selectors';
import { updateSelectedTrain, updateSelectedProjection } from 'reducers/osrdsimulation/actions';
import { MODES, STDCM_REQUEST_STATUS } from 'applications/operationalStudies/consts';
import { updateMode } from 'reducers/osrdconf';
import OSRDStdcmConfig from './OSRDCStdcmConfig';
import OSRDStdcmResults from './OSRDStdcmResults';
import StdcmRequestModal from './StdcmRequestModal';

export default function OSRDSTDCM() {
  const dispatch = useDispatch();
  const mode = useSelector(getMode);
  const [currentStdcmRequestStatus, setCurrentStdcmRequestStatus] = useState(
    STDCM_REQUEST_STATUS.idle
  );
  const [, setCurrentStdcmRequestResults] = useState(null);
  useEffect(() => {
    if(mode !== MODES.stdcm) dispatch(updateMode(MODES.stdcm));
    return () => {
      dispatch(updateMode(MODES.simulation));
      dispatch(updateSelectedTrain(0));
      dispatch(updateSelectedProjection(undefined));
    };
  }, []);

  return (
    <>
      <OSRDStdcmConfig setCurrentStdcmRequestStatus={setCurrentStdcmRequestStatus} />
      <StdcmRequestModal
        setCurrentStdcmRequestResults={setCurrentStdcmRequestResults}
        setCurrentStdcmRequestStatus={setCurrentStdcmRequestStatus}
        currentStdcmRequestStatus={currentStdcmRequestStatus}
      />
      {currentStdcmRequestStatus === STDCM_REQUEST_STATUS.success && (
        <OSRDStdcmResults currentStdcmRequestStatus={currentStdcmRequestStatus} />
      )}
    </>
  );
}
