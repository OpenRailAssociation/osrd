import { useEffect, useState } from 'react';

import { isEqual } from 'lodash';

import useStdcm from 'applications/stdcm/hooks/useStdcm';
import { useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';

import useStdcmEnvironment from '../hooks/useStdcmEnv';
import type { StdcmSimulationInputs, StdcmSimulation } from '../types';

type UseViewProps = {
  initialSimulationsList?: StdcmSimulation[];
};
const useView = (props?: UseViewProps) => {
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
  const [simulationsList, setSimulationsList] = useState<StdcmSimulation[]>(
    props?.initialSimulationsList || []
  );
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
      setSelectedSimulationIndex(simulationsList.length);
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
  // useEffect(() => {
  //   const length = simulationsList.length;
  //     console.log("LENGTH 2", length);
  //   if (simulationsList.length > 0) {
  //     setSelectedSimulationIndex(simulationsList.length - 1);
  //   }
  // }, [simulationsList]);

  return {
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
  };
};

export default useView;
