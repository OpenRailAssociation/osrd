import React, { useState } from 'react';

import { useSelector } from 'react-redux';

import useStdcm from 'applications/stdcm/hooks/useStdcm';
import { useOsrdConfSelectors } from 'common/osrdContext';

import StdcmConfig from '../components/StdcmConfig';
import StdcmHeader from '../components/StdcmHeader';
import StdcmResults from '../components/StdcmResults';
import type { StdcmSimulationResult } from '../types';

const StdcmViewV2 = () => {
  const { launchStdcmRequest, cancelStdcmRequest, isPending, stdcmV2Results, pathProperties } =
    useStdcm();
  const { getScenarioID } = useOsrdConfSelectors();
  const scenarioID = useSelector(getScenarioID);

  const [currentSimulationInputs, setCurrentSimulationInputs] = useState<
    StdcmSimulationResult['input'] | undefined
  >(undefined);

  return (
    <div className="stdcm-v2">
      <StdcmHeader />
      {scenarioID && (
        <StdcmConfig
          currentSimulationInputs={currentSimulationInputs}
          pathProperties={pathProperties}
          isPending={isPending}
          launchStdcmRequest={launchStdcmRequest}
          cancelStdcmRequest={cancelStdcmRequest}
          setCurrentSimulationInputs={setCurrentSimulationInputs}
        />
      )}
      {stdcmV2Results?.stdcmResponse && !isPending && (
        <StdcmResults
          // TODO: Next step : use currentSimulationInputs instead of stdcmSimulationResults to handle multiples simulations results
          stdcmData={stdcmV2Results?.stdcmResponse}
          pathProperties={pathProperties}
        />
      )}
    </div>
  );
};

export default StdcmViewV2;
