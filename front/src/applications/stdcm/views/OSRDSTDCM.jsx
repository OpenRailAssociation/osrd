import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getMode } from 'reducers/osrdconf/selectors';

import { MODES, STDCM_REQUEST_STATUS } from 'applications/operationalStudies/consts';
import { updateMode } from 'reducers/osrdconf';
import OSRDStdcmConfig from './OSRDCStdcmConfig';
import OSRDStdcmResults from './OSRDStdcmResults';
import StdcmRequestModal from './StdcmRequestModal';


const keylog = [];
document.onkeydown = (e) => {
  const keypressed = e.key;
  keylog.push(keypressed);
  if (keylog.join('') === 'boum') {
    const ascii = [
      '',
      ' ___________________    . , ',
      '(___________________|~~~~~X.;',
      '                     ` `"  ;',
      '            TNT',
    ].join('\n');
    throw ascii;
  }
};

export default function OSRDSTDCM() {
  const dispatch = useDispatch();
  const mode = useSelector(getMode);

  const [currentStdcmRequestStatus, setCurrentStdcmRequestStatus] = useState(
    STDCM_REQUEST_STATUS.idle
  );
  const [, setCurrentStdcmRequestResults] = useState(null);
  useEffect(() => {
    if(mode !== MODES.stdcm) dispatch(updateMode(MODES.stdcm));
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
