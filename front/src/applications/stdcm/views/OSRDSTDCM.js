import React, { useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';
import { MODES, STDCM_REQUEST_STATUS } from '../../osrd/consts';
import OSRDStdcmConfig from './OSRDCStdcmConfig';
import OSRDStdcmResults from './OSRDStdcmResults';
import StdcmRequestModal from './StdcmRequestModal';
import { updateMode } from '../../../reducers/osrdconf';

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
  const [currentStdcmRequestStatus, setCurrentStdcmRequestStatus] = useState(
    STDCM_REQUEST_STATUS.idle
  );
  const [, setCurrentStdcmRequestResults] = useState(null);
  useEffect(() => {
    dispatch(updateMode(MODES.stdcm));
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
