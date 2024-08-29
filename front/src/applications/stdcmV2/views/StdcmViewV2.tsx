import React from 'react';

import { isNil } from 'lodash';

import { LoaderFill } from 'common/Loaders';

import useView from './useView';
import StdcmConfig from '../components/StdcmConfig';
import StdcmEmptyConfigError from '../components/StdcmEmptyConfigError';
import StdcmHeader from '../components/StdcmHeader';
import StdcmResults from '../components/StdcmResults';
import { NO_CONFIG_FOUND_MSG } from '../hooks/useStdcmEnv';

const StdcmViewV2 = () => {
  const {
    error,
    loading,
    selectedSimulation,
    currentSimulationInputs,
    pathProperties,
    isPending,
    showBtnToLaunchSimulation,
    retainedSimulationIndex,
    showStatusBanner,
    isCalculationFailed,
    showResults,
    selectedSimulationIndex,
    simulationsList,
    setShowStatusBanner,
    launchStdcmRequest,
    cancelStdcmRequest,
    setCurrentSimulationInputs,
    handleRetainSimulation,
    handleSelectSimulation,
    handleStartNewQuery,
  } = useView();

  // If we've got an error during the loading of the stdcm env which is not the "no config error" message,
  // we let the error boundary manage it
  if (error && error.message !== NO_CONFIG_FOUND_MSG) throw error;

  return (
    <div role="button" tabIndex={0} className="stdcm-v2" onClick={() => setShowStatusBanner(false)}>
      <StdcmHeader />

      {!isNil(error) ? (
        <StdcmEmptyConfigError />
      ) : (
        <div>
          <StdcmConfig
            selectedSimulation={selectedSimulation}
            currentSimulationInputs={currentSimulationInputs}
            pathProperties={pathProperties}
            isPending={isPending}
            showBtnToLaunchSimulation={showBtnToLaunchSimulation}
            retainedSimulationIndex={retainedSimulationIndex}
            showStatusBanner={showStatusBanner}
            isCalculationFailed={isCalculationFailed}
            launchStdcmRequest={launchStdcmRequest}
            cancelStdcmRequest={cancelStdcmRequest}
            setCurrentSimulationInputs={setCurrentSimulationInputs}
          />

          {showResults && (
            <div className="stdcm-v2-results">
              {selectedSimulationIndex > -1 && (
                <StdcmResults
                  simulationsList={simulationsList}
                  selectedSimulationIndex={selectedSimulationIndex}
                  retainedSimulationIndex={retainedSimulationIndex}
                  showStatusBanner={showStatusBanner}
                  isCalculationFailed={isCalculationFailed}
                  onRetainSimulation={handleRetainSimulation}
                  onSelectSimulation={handleSelectSimulation}
                  onStartNewQuery={handleStartNewQuery}
                />
              )}
            </div>
          )}
        </div>
      )}
      {loading && <LoaderFill />}
    </div>
  );
};

export default StdcmViewV2;
