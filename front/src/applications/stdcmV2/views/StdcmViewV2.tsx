import React, { useState } from 'react';

import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { useOsrdConfSelectors } from 'common/osrdContext';

import StdcmConfig from '../components/StdcmConfig';
import StdcmHeader from '../components/StdcmHeader';
import type { StdcmSimulationResult } from '../types';

const StdcmViewV2 = () => {
  const { getScenarioID } = useOsrdConfSelectors();
  const scenarioID = useSelector(getScenarioID);

  const [pathProperties, setPathProperties] = useState<ManageTrainSchedulePathProperties>();

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
          setPathProperties={setPathProperties}
          setCurrentSimulationInputs={setCurrentSimulationInputs}
        />
      )}
    </div>
  );
};

export default StdcmViewV2;
