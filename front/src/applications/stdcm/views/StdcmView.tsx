import { useEffect, useState } from 'react';

import { isEqual, isNil } from 'lodash';
import { useSelector } from 'react-redux';

import useStdcm from 'applications/stdcm/hooks/useStdcm';
import { LoaderFill } from 'common/Loaders';
import { useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { getStdcmConf } from 'reducers/osrdconf/stdcmConf/selectors';
import { useAppDispatch } from 'store';
import { replaceElementAtIndex } from 'utils/array';

import StdcmEmptyConfigError from '../components/StdcmEmptyConfigError';
import StdcmConfig from '../components/StdcmForm/StdcmConfig';
import StdcmHeader from '../components/StdcmHeader';
import StdcmHelpModule from '../components/StdcmHelpModule/StdcmHelpModule';
import StdcmResults from '../components/StdcmResults';
import StdcmStatusBanner from '../components/StdcmStatusBanner';
import useStdcmEnvironment, { NO_CONFIG_FOUND_MSG } from '../hooks/useStdcmEnv';
import useStdcmForm from '../hooks/useStdcmForm';
import type { StdcmSimulation } from '../types';

const StdcmView = () => {
  // TODO : refacto. state useStdcm. Maybe we can merge some state together in order to reduce the number of refresh
  const currentSimulationInputs = useStdcmForm();
  const stdcmConf = useSelector(getStdcmConf);
  const [simulationsList, setSimulationsList] = useState<StdcmSimulation[]>([]);
  const [selectedSimulationIndex, setSelectedSimulationIndex] = useState(-1);
  const [showStatusBanner, setShowStatusBanner] = useState(false);
  const [retainedSimulationIndex, setRetainedSimulationIndex] = useState(-1);
  const [showBtnToLaunchSimulation, setShowBtnToLaunchSimulation] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [showHelpModule, setShowHelpModule] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(true);

  const {
    launchStdcmRequest,
    cancelStdcmRequest,
    resetStdcmState,
    isPending,
    isRejected,
    isCanceled,
    stdcmResults,
    pathProperties,
    stdcmTrainConflicts,
    hasConflicts,
    isCalculationFailed,
  } = useStdcm({ showFailureNotification: false });

  const { loading, error, loadStdcmEnvironment } = useStdcmEnvironment();

  const dispatch = useAppDispatch();
  const { updateStdcmConfigWithData } = useOsrdConfActions() as StdcmConfSliceActions;

  const selectedSimulation = simulationsList[selectedSimulationIndex];
  const showResults = showStatusBanner || simulationsList.length > 0 || hasConflicts;

  const handleRetainSimulation = () => setRetainedSimulationIndex(selectedSimulationIndex);

  const handleSelectSimulation = (index: number) => {
    if (retainedSimulationIndex === -1) {
      setSelectedSimulationIndex(index);
      setShowBtnToLaunchSimulation(false);
    }
  };

  const openNewWindow = (keepForm: boolean) => {
    const newWindow = window.open(window.location.href, '_blank');
    if (newWindow) {
      if (keepForm) {
        newWindow.osrdStdcmConfState = stdcmConf;
      }
      newWindow.onload = () => {
        newWindow.focus();
      };
    }
  };

  const handleStartNewQuery = () => {
    setButtonsVisible(false);
    resetStdcmState();

    openNewWindow(false);
  };

  const handleStartNewQueryWithData = () => {
    setButtonsVisible(false);

    openNewWindow(true);
  };

  const toggleHelpModule = () => setShowHelpModule((show) => !show);

  // reset config data with the selected simulation data
  useEffect(() => {
    if (selectedSimulation) {
      const { pathSteps, consist } = selectedSimulation.inputs;
      dispatch(
        updateStdcmConfigWithData({
          rollingStockID: consist?.tractionEngine?.id,
          towedRollingStockID: consist?.towedRollingStock?.id,
          totalLength: consist?.totalLength,
          totalMass: consist?.totalMass,
          maxSpeed: consist?.maxSpeed,
          speedLimitByTag: consist?.speedLimitByTag,
          stdcmPathSteps: pathSteps,
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
    if (isCanceled) {
      setShowBtnToLaunchSimulation(true);
    }
  }, [isCanceled]);

  useEffect(() => {
    /*
     * Due to frequent re-renders and the fact that "speedSpaceChartData" is initially null before
     * "formattedPathProperties" is computed, we need to check if the current simulation is already
     * listed in the simulations list. This helps us determine whether to add a new simulation or update
     * the existing one.
     */
    const lastSimulation = simulationsList[simulationsList.length - 1];
    const isSimulationAlreadyListed = isEqual(lastSimulation?.inputs, currentSimulationInputs);
    const isSimulationOutputsComplete = stdcmResults?.stdcmResponse || hasConflicts;

    if (isSimulationOutputsComplete) {
      const newSimulation = {
        ...(isSimulationAlreadyListed
          ? { ...lastSimulation }
          : {
              id: simulationsList.length + 1,
              creationDate: new Date(),
              inputs: currentSimulationInputs,
            }),
        ...(pathProperties && {
          outputs: {
            pathProperties,
            ...(stdcmResults?.stdcmResponse &&
              stdcmResults?.speedSpaceChartData && {
                results: stdcmResults.stdcmResponse,
                speedSpaceChartData: stdcmResults.speedSpaceChartData,
              }),
            ...(stdcmTrainConflicts && {
              conflicts: stdcmTrainConflicts,
            }),
          },
        }),
      };

      const updateSimulationsList = isSimulationAlreadyListed
        ? replaceElementAtIndex(simulationsList, simulationsList.length - 1, newSimulation)
        : [...simulationsList, newSimulation];

      setSimulationsList(updateSimulationsList as StdcmSimulation[]);
      setShowStatusBanner(true);
    }
  }, [
    pathProperties,
    stdcmResults?.speedSpaceChartData?.formattedPathProperties,
    stdcmTrainConflicts,
  ]);

  // We have a simulation with an error.
  useEffect(() => {
    if (isRejected) {
      setShowStatusBanner(true);
    }
  }, [isRejected]);

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
    <div role="button" tabIndex={0} className="stdcm" onClick={() => setShowStatusBanner(false)}>
      <StdcmHeader
        isDebugMode={isDebugMode}
        onDebugModeToggle={setIsDebugMode}
        toggleHelpModule={toggleHelpModule}
        showHelpModule={showHelpModule}
      />

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
            cancelStdcmRequest={cancelStdcmRequest}
          />

          {showStatusBanner && <StdcmStatusBanner isFailed={isCalculationFailed} />}

          {showResults && (
            <div className="stdcm-results">
              {(selectedSimulationIndex > -1 || hasConflicts) && (
                <StdcmResults
                  isCalculationFailed={isCalculationFailed}
                  isDebugMode={isDebugMode}
                  onRetainSimulation={handleRetainSimulation}
                  onSelectSimulation={handleSelectSimulation}
                  onStartNewQuery={handleStartNewQuery}
                  onStartNewQueryWithData={handleStartNewQueryWithData}
                  buttonsVisible={buttonsVisible}
                  retainedSimulationIndex={retainedSimulationIndex}
                  selectedSimulationIndex={selectedSimulationIndex}
                  showStatusBanner={showStatusBanner}
                  simulationsList={simulationsList}
                />
              )}
            </div>
          )}
          <StdcmHelpModule showHelpModule={showHelpModule} toggleHelpModule={toggleHelpModule} />
        </div>
      )}
      {loading && <LoaderFill />}
    </div>
  );
};

export default StdcmView;
