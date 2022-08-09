import React, { useEffect, useState } from 'react';

import { MODES } from '../../osrd/consts';
import OSRDConfig from '../../osrd/views/OSRDConfig/OSRDConfig';
import OSRDStdcmResults from './OSRDStdcmResults'
import StdcmRequestModal from './StdcmRequestModal';
import { updateMode } from '../../../reducers/osrdconf';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

export const stdcmRequestStatus = {
  idle: 'IDLE',
  pending: 'PENDING',
  success: 'SUCCESS',
  rejected: 'REJECTED',
  canceled: 'CANCELED',
  noresults: 'NORESULTS'
}

export default function OSRDSTDCM() {
  const { t } = useTranslation(['translation', 'osrdconf']);
  const dispatch = useDispatch();
  const [currentStdcmRequestStatus, setCurrentStdcmRequestStatus] = useState(null);
  const [currentStdcmRequestResults, setCurrentStdcmRequestResults] = useState(null);
  useEffect(() => {
    dispatch(updateMode(MODES.stdcm));
  }, []);

  useEffect(() => {
    console.log("new status", currentStdcmRequestStatus)
  }, [currentStdcmRequestStatus]);

  return (
    <>
      <OSRDConfig
        setCurrentStdcmRequestStatus={setCurrentStdcmRequestStatus}
      />
      <StdcmRequestModal
        setCurrentStdcmRequestResults={setCurrentStdcmRequestResults}
        setCurrentStdcmRequestStatus={setCurrentStdcmRequestStatus}
        currentStdcmRequestStatus = {currentStdcmRequestStatus}
      />
      <OSRDStdcmResults currentStdcmRequestStatus = {currentStdcmRequestStatus} />
    </>
  );
}
