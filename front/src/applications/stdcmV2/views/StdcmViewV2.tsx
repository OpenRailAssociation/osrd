import { useEffect, useState } from 'react';

import { isEqual, isNil } from 'lodash';

import useStdcm from 'applications/stdcm/hooks/useStdcm';
import { LoaderFill } from 'common/Loaders';
import { useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';
import { replaceElementAtIndex } from 'utils/array';

import StdcmConfig from '../components/StdcmConfig';
import StdcmEmptyConfigError from '../components/StdcmEmptyConfigError';
import StdcmHeader from '../components/StdcmHeader';
import StdcmResults from '../components/StdcmResults';
import useStdcmEnvironment, { NO_CONFIG_FOUND_MSG } from '../hooks/useStdcmEnv';
import type { StdcmSimulation, StdcmSimulationInputs } from '../types';

const StdcmViewV2 = () => {
  // TODO : refacto. state useStdcm. Maybe we can merge some state together in order to reduce the number of refresh
  const [currentSimulationInputs, setCurrentSimulationInputs] = useState<StdcmSimulationInputs>({
    pathSteps: [null, null], // origin and destination are not set yet. We use the same logic as in the store.
  });
  const [simulationsList, setSimulationsList] = useState<StdcmSimulation[]>([]);
  const [selectedSimulationIndex, setSelectedSimulationIndex] = useState(-1);
  const [showStatusBanner, setShowStatusBanner] = useState(false);
  const [retainedSimulationIndex, setRetainedSimulationIndex] = useState(-1);
  const [showBtnToLaunchSimulation, setShowBtnToLaunchSimulation] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);

  const {
    launchStdcmRequest,
    cancelStdcmRequest,
    isPending,
    isRejected,
    isStdcmResultsEmpty,
    stdcmV2Results,
    pathProperties,
  } = useStdcm(isDebugMode, { showFailureNotification: false });

  const { loading, error, loadStdcmEnvironment } = useStdcmEnvironment();

  const dispatch = useAppDispatch();
  const { resetStdcmConfig, updateStdcmConfigWithData } =
    useOsrdConfActions() as StdcmConfSliceActions;

  const selectedSimulation = simulationsList[selectedSimulationIndex];
  const isCalculationFailed = isRejected && !isStdcmResultsEmpty;
  const showResults = !isPending && (showStatusBanner || simulationsList.length > 0);

  const handleRetainSimulation = () => setRetainedSimulationIndex(selectedSimulationIndex);

  const handleSelectSimulation = (index: number) => {
    if (retainedSimulationIndex === -1) {
      setSelectedSimulationIndex(index);
      setShowBtnToLaunchSimulation(false);
    }
  };

  const handleStartNewQuery = () => {
    setSimulationsList([]);
    setSelectedSimulationIndex(-1);
    setRetainedSimulationIndex(-1);
    dispatch(resetStdcmConfig());
  };

  // reset config data with the selected simulation data
  useEffect(() => {
    if (selectedSimulation) {
      const { departureDate, departureTime, pathSteps, consist } = selectedSimulation.inputs;
      dispatch(
        updateStdcmConfigWithData({
          rollingStockID: consist?.tractionEngine?.id,
          speedLimitByTag: consist?.speedLimitByTag,
          pathSteps: [...pathSteps],
          originDate: departureDate,
          originTime: departureTime,
        })
      );
    }
  }, [selectedSimulation]);

  useEffect(() => {
    setShowBtnToLaunchSimulation(!isEqual(currentSimulationInputs, selectedSimulation?.inputs));
  }, [currentSimulationInputs]);

  useEffect(() => {
    if (isPending) {
      setShowBtnToLaunchSimulation(false);
    }
  }, [isPending]);

  useEffect(() => {
    if (!isDebugMode) {
      loadStdcmEnvironment();
    }
  }, [isDebugMode]);

  useEffect(() => {
    /*
     * Due to frequent re-renders and the fact that "speedSpaceChartData" is initially null before
     * "formattedPathProperties" is computed, we need to check if the current simulation is already
     * listed in the simulations list. This helps us determine whether to add a new simulation or update
     * the existing one.
     */
    const lastSimulation = simulationsList[simulationsList.length - 1];
    const isSimulationAlreadyListed = isEqual(lastSimulation?.inputs, currentSimulationInputs);
    const isSimulationOutputsComplete =
      stdcmV2Results?.stdcmResponse && stdcmV2Results?.speedSpaceChartData?.formattedPathProperties;

    if (isSimulationOutputsComplete || isStdcmResultsEmpty) {
      const newSimulation = {
        ...(isSimulationAlreadyListed
          ? { ...lastSimulation }
          : {
              id: simulationsList.length + 1,
              creationDate: new Date(),
              inputs: currentSimulationInputs,
            }),
        ...(stdcmV2Results?.stdcmResponse &&
          stdcmV2Results.speedSpaceChartData &&
          pathProperties && {
            outputs: {
              pathProperties,
              results: stdcmV2Results.stdcmResponse,
              speedSpaceChartData: stdcmV2Results.speedSpaceChartData,
            },
          }),
      };

      const updateSimulationsList = isSimulationAlreadyListed
        ? replaceElementAtIndex(simulationsList, simulationsList.length - 1, newSimulation)
        : [...simulationsList, newSimulation];

      setSimulationsList(updateSimulationsList);
      setShowStatusBanner(true);
    }
  }, [
    pathProperties,
    isStdcmResultsEmpty,
    stdcmV2Results?.speedSpaceChartData?.formattedPathProperties,
  ]);

  // We have a simulation with an error.
  useEffect(() => {
    if (isRejected && !isStdcmResultsEmpty) {
      setShowStatusBanner(true);
    }
  }, [isRejected, isStdcmResultsEmpty]);

  // select the last simulation in the list
  useEffect(() => {
    if (simulationsList.length > 0) {
      setSelectedSimulationIndex(simulationsList.length - 1);
    }
  }, [simulationsList]);

  // If we've got an error during the loading of the stdcm env which is not the "no config error" message,
  // we let the error boundary manage it
  if (error && error.message !== NO_CONFIG_FOUND_MSG) throw error;

  return (
    <div role="button" tabIndex={0} className="stdcm-v2" onClick={() => setShowStatusBanner(false)}>
      <StdcmHeader isDebugMode={isDebugMode} onDebugModeToggle={setIsDebugMode} />

      {!isNil(error) ? (
        <StdcmEmptyConfigError />
      ) : (
        <div>
          <StdcmConfig
            cancelStdcmRequest={cancelStdcmRequest}
            isCalculationFailed={isCalculationFailed}
            isDebugMode={isDebugMode}
            isPending={isPending}
            launchStdcmRequest={launchStdcmRequest}
            retainedSimulationIndex={retainedSimulationIndex}
            selectedSimulation={selectedSimulation}
            setCurrentSimulationInputs={setCurrentSimulationInputs}
            showBtnToLaunchSimulation={showBtnToLaunchSimulation}
            showStatusBanner={showStatusBanner}
          />

          {showResults && (
            <div className="stdcm-v2-results">
              {selectedSimulationIndex > -1 && (
                <StdcmResults
                  isCalculationFailed={isCalculationFailed}
                  isDebugMode={isDebugMode}
                  onRetainSimulation={handleRetainSimulation}
                  onSelectSimulation={handleSelectSimulation}
                  onStartNewQuery={handleStartNewQuery}
                  retainedSimulationIndex={retainedSimulationIndex}
                  selectedSimulationIndex={selectedSimulationIndex}
                  showStatusBanner={showStatusBanner}
                  simulationsList={simulationsList}
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
