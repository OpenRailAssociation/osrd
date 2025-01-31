import { useEffect, useState } from 'react';

import { isEqual, isNil } from 'lodash';
import { useSelector } from 'react-redux';

import useStdcm from 'applications/stdcm/hooks/useStdcm';
import { LoaderFill } from 'common/Loaders';
import {
  addNewStdcmResult,
  selectSimulation,
  updateLastStdcmResult,
} from 'reducers/osrdconf/stdcmConf';
import {
  getRetainedSimulationIndex,
  getSelectedSimulationIndex,
  getStdcmConf,
  getStdcmSimulations,
} from 'reducers/osrdconf/stdcmConf/selectors';
import { useAppDispatch } from 'store';

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
  const simulationsList = useSelector(getStdcmSimulations);
  const selectedSimulationIndex = useSelector(getSelectedSimulationIndex);
  const retainedSimulationIndex = useSelector(getRetainedSimulationIndex);

  const [showStatusBanner, setShowStatusBanner] = useState(false);
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

  const handleSelectSimulation = (index: number) => {
    if (retainedSimulationIndex === undefined) {
      dispatch(selectSimulation(index));
      setShowBtnToLaunchSimulation(false);
    }
  };

  const openNewWindow = (keepForm: boolean) => {
    const newWindow = window.open(window.location.href, '_blank');
    if (newWindow) {
      if (keepForm) {
        newWindow.osrdStdcmConfState = {
          ...stdcmConf,
          simulations: [],
          selectedSimulationIndex: undefined,
          retainedSimulationIndex: undefined,
        };
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

  useEffect(() => {
    setShowBtnToLaunchSimulation(
      selectedSimulationIndex === undefined ||
        !isEqual(currentSimulationInputs, simulationsList[selectedSimulationIndex].inputs)
    );
  }, [currentSimulationInputs]);

  useEffect(() => {
    if (isPending) {
      setShowBtnToLaunchSimulation(false);
    }
  }, [isPending]);

  useEffect(() => {
    if (isCanceled) {
      setShowBtnToLaunchSimulation(true);
    }
  }, [isCanceled]);

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
    const lastSimulation = simulationsList.at(simulationsList.length - 1);
    const isSimulationAlreadyListed = isEqual(lastSimulation?.inputs, currentSimulationInputs);
    const isSimulationOutputsComplete = stdcmResults?.stdcmResponse ?? hasConflicts;

    if (isSimulationOutputsComplete) {
      const newSimulation = {
        ...(isSimulationAlreadyListed
          ? { ...lastSimulation }
          : {
              index: simulationsList.length,
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

      if (isSimulationAlreadyListed) {
        dispatch(updateLastStdcmResult(newSimulation as StdcmSimulation));
      } else {
        dispatch(addNewStdcmResult(newSimulation as StdcmSimulation));
      }
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

          {simulationsList.length && (
            <div className="stdcm-results">
              <StdcmResults
                isCalculationFailed={isCalculationFailed}
                isDebugMode={isDebugMode}
                onSelectSimulation={handleSelectSimulation}
                onStartNewQuery={handleStartNewQuery}
                onStartNewQueryWithData={handleStartNewQueryWithData}
                buttonsVisible={buttonsVisible}
                showStatusBanner={showStatusBanner}
              />
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
