import { useEffect, useState } from 'react';

import { isEqual, isNil } from 'lodash';

import useStdcm from 'applications/stdcm/hooks/useStdcm';
import { LoaderFill } from 'common/Loaders';
import { useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';

import StdcmConfig from '../components/StdcmConfig';
import StdcmEmptyConfigError from '../components/StdcmEmptyConfigError';
import StdcmHeader from '../components/StdcmHeader';
import StdcmResults from '../components/StdcmResults';
import useStdcmEnvironment, { NO_CONFIG_FOUND_MSG } from '../hooks/useStdcmEnv';
import type { StdcmSimulation, StdcmSimulationInputs } from '../types';

const StdcmViewV2 = () => {
  const { loading, error } = useStdcmEnvironment();
  // TODO : refacto. state useStdcm. Maybe we can merge some state together in order to reduce the number of refresh
  const {
    launchStdcmRequest,
    cancelStdcmRequest,
    isPending,
    isRejected,
    isStdcmResultsEmpty,
    stdcmV2Results,
    pathProperties,
  } = useStdcm(false);
  const [currentSimulationInputs, setCurrentSimulationInputs] = useState<StdcmSimulationInputs>({
    pathSteps: [null, null], // origin and destination are not set yet. We use the same logic as in the store.
  });
  const [simulationsList, setSimulationsList] = useState<StdcmSimulation[]>([]);
  const [selectedSimulationIndex, setSelectedSimulationIndex] = useState(-1);
  const [showStatusBanner, setShowStatusBanner] = useState(false);
  const [retainedSimulationIndex, setRetainedSimulationIndex] = useState(-1);
  const [showBtnToLaunchSimulation, setShowBtnToLaunchSimulation] = useState(false);

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
    if (currentSimulationInputs && (stdcmV2Results?.stdcmResponse || isStdcmResultsEmpty)) {
      setSimulationsList((prevSimulationList) => [
        ...prevSimulationList,
        {
          id: prevSimulationList.length + 1,
          creationDate: new Date(),
          inputs: currentSimulationInputs,
          ...(stdcmV2Results?.stdcmResponse &&
            pathProperties && {
              outputs: {
                results: stdcmV2Results.stdcmResponse,
                pathProperties,
              },
            }),
        },
      ]);
      setShowStatusBanner(true);
    }
  }, [pathProperties, isStdcmResultsEmpty]);

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
      <StdcmHeader />

      {!isNil(error) ? (
        <StdcmEmptyConfigError />
      ) : (
        <div>
          <StdcmConfig
            selectedSimulation={selectedSimulation}
            currentSimulationInputs={currentSimulationInputs}
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
