import { useEffect, useState, useRef } from 'react';

import { isEqual, isNil } from 'lodash';

import useStdcm from 'applications/stdcm/hooks/useStdcm';
import { LoaderFill } from 'common/Loaders';
import { useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';
import { replaceElementAtIndex } from 'utils/array';

import StdcmEmptyConfigError from '../components/StdcmEmptyConfigError';
import StdcmConfig from '../components/StdcmForm/StdcmConfig';
import StdcmHeader from '../components/StdcmHeader';
import StdcmLoader from '../components/StdcmLoader';
import StdcmResults from '../components/StdcmResults';
import StdcmStatusBanner from '../components/StdcmStatusBanner';
import useStdcmEnvironment, { NO_CONFIG_FOUND_MSG } from '../hooks/useStdcmEnv';
import useStdcmForm from '../hooks/useStdcmForm';
import type { StdcmSimulation } from '../types';

const StdcmView = () => {
  // TODO : refacto. state useStdcm. Maybe we can merge some state together in order to reduce the number of refresh
  const currentSimulationInputs = useStdcmForm();
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
    stdcmResults,
    pathProperties,
  } = useStdcm({ showFailureNotification: false });

  const { loading, error, loadStdcmEnvironment } = useStdcmEnvironment();

  const dispatch = useAppDispatch();
  const { resetStdcmConfig, updateStdcmConfigWithData } =
    useOsrdConfActions() as StdcmConfSliceActions;

  const selectedSimulation = simulationsList[selectedSimulationIndex];
  const isCalculationFailed = isRejected && !isStdcmResultsEmpty;
  const showResults = !isPending && (showStatusBanner || simulationsList.length > 0);
  const loaderRef = useRef<HTMLDivElement>(null);

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
      const { pathSteps, consist } = selectedSimulation.inputs;
      dispatch(
        updateStdcmConfigWithData({
          rollingStockID: consist?.tractionEngine?.id,
          speedLimitByTag: consist?.speedLimitByTag,
          pathSteps: [...pathSteps],
        })
      );
    }
  }, [selectedSimulation]);

  useEffect(() => {
    if (!isDebugMode) {
      setShowBtnToLaunchSimulation(!isEqual(currentSimulationInputs, selectedSimulation?.inputs));
    }
  }, [currentSimulationInputs]);

  useEffect(() => {
    if (isPending && !isDebugMode) {
      setShowBtnToLaunchSimulation(false);
    }
  }, [isPending]);

  useEffect(() => {
    if (!isDebugMode) {
      loadStdcmEnvironment();
    } else {
      setShowBtnToLaunchSimulation(true);
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
      stdcmResults?.stdcmResponse && stdcmResults?.speedSpaceChartData?.formattedPathProperties;

    if (isSimulationOutputsComplete || isStdcmResultsEmpty) {
      const newSimulation = {
        ...(isSimulationAlreadyListed
          ? { ...lastSimulation }
          : {
              id: simulationsList.length + 1,
              creationDate: new Date(),
              inputs: currentSimulationInputs,
            }),
        ...(stdcmResults?.stdcmResponse &&
          stdcmResults.speedSpaceChartData &&
          pathProperties && {
            outputs: {
              pathProperties,
              results: stdcmResults.stdcmResponse,
              speedSpaceChartData: stdcmResults.speedSpaceChartData,
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
    stdcmResults?.speedSpaceChartData?.formattedPathProperties,
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

  useEffect(() => {
    if (isPending) {
      loaderRef?.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isPending]);

  // If we've got an error during the loading of the stdcm env which is not the "no config error" message,
  // we let the error boundary manage it
  if (error && error.message !== NO_CONFIG_FOUND_MSG) throw error;

  return (
    <div role="button" tabIndex={0} className="stdcm" onClick={() => setShowStatusBanner(false)}>
      <StdcmHeader isDebugMode={isDebugMode} onDebugModeToggle={setIsDebugMode} />

      {!isNil(error) ? (
        <StdcmEmptyConfigError />
      ) : (
        <div>
          <StdcmConfig
            isPending={isPending}
            isDebugMode={isDebugMode}
            showBtnToLaunchSimulation={showBtnToLaunchSimulation}
            retainedSimulationIndex={retainedSimulationIndex}
            launchStdcmRequest={launchStdcmRequest}
          />

          {isPending && <StdcmLoader cancelStdcmRequest={cancelStdcmRequest} ref={loaderRef} />}
          {showStatusBanner && <StdcmStatusBanner isFailed={isCalculationFailed} />}

          {showResults && (
            <div className="stdcm-results">
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
                  pathTrackRanges={stdcmResults?.stdcmResponse.path.track_section_ranges}
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

export default StdcmView;
