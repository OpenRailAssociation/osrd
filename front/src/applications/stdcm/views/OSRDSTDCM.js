import React, { useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';
import { MODES, STDCM_REQUEST_STATUS } from '../../osrd/consts';
import OSRDConfig from '../../osrd/views/OSRDConfig/OSRDConfig';
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
      <OSRDConfig setCurrentStdcmRequestStatus={setCurrentStdcmRequestStatus} />
      <StdcmRequestModal
        setCurrentStdcmRequestResults={setCurrentStdcmRequestResults}
        setCurrentStdcmRequestStatus={setCurrentStdcmRequestStatus}
        currentStdcmRequestStatus={currentStdcmRequestStatus}
      />
      <OSRDStdcmResults currentStdcmRequestStatus={currentStdcmRequestStatus} />
    </>
  );
}
