import React, { useEffect, useState } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useStdcm from 'applications/stdcm/hooks/useStdcm';
import { useOsrdConfSelectors } from 'common/osrdContext';

import StdcmConfig from '../components/StdcmConfig';
import StdcmHeader from '../components/StdcmHeader';
import StdcmResults from '../components/StdcmResults';
import type { StdcmSimulationResult } from '../types';

const StdcmViewV2 = () => {
  const { t } = useTranslation('stdcm');
  const { launchStdcmRequest, cancelStdcmRequest, isPending, stdcmV2Results, pathProperties } =
    useStdcm();
  const { getScenarioID } = useOsrdConfSelectors();
  const scenarioID = useSelector(getScenarioID);

  const [currentSimulationInputs, setCurrentSimulationInputs] = useState<
    StdcmSimulationResult['input'] | undefined
  >(undefined);

  const [interactedResultsElements, setInteractedResultsElements] = useState(false);

  useEffect(() => {
    setInteractedResultsElements(false);
  }, [currentSimulationInputs]);

  return (
    <div className="stdcm-v2">
      <StdcmHeader />
      <div
        className={cx('stdcm-container', {
          'simulation-visible':
            !isPending && !currentSimulationInputs && !interactedResultsElements,
        })}
      >
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
        {scenarioID && !isPending && !currentSimulationInputs && !interactedResultsElements && (
          <div className="simulation-available">
            <span>{t('simulation.available')}</span>
          </div>
        )}
        {stdcmV2Results?.stdcmResponse && !isPending && (
          <StdcmResults
            // TODO: Next step : use currentSimulationInputs instead of stdcmSimulationResults to handle multiple simulation results
            stdcmData={stdcmV2Results.stdcmResponse}
            pathProperties={pathProperties}
            setInteractedResultsElements={setInteractedResultsElements}
          />
        )}
      </div>
    </div>
  );
};

export default StdcmViewV2;
