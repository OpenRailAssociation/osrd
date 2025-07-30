import {
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  type Dispatch,
  type SetStateAction,
  useMemo,
  useCallback,
} from 'react';

import { isEqual, isNil } from 'lodash';
import { useSelector } from 'react-redux';

import { LoaderFill } from 'common/Loaders';
import { selectSimulation } from 'reducers/osrdconf/stdcmConf';
import {
  getRetainedSimulationIndex,
  getSelectedSimulationIndex,
  getStdcmCompletedSimulations,
  getStdcmConf,
  getStdcmSimulations,
} from 'reducers/osrdconf/stdcmConf/selectors';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import StdcmEmptyConfigError from './components/StdcmEmptyConfigError';
import StdcmConfig from './components/StdcmForm/StdcmConfig';
import StdcmHeader from './components/StdcmHeader';
import StdcmHelpModule from './components/StdcmHelpModule';
import StdcmResults from './components/StdcmResults';
import StdcmStatusBanner from './components/StdcmStatusBanner';
import useStdcm from './hooks/useStdcm';
import useStdcmEnvironment, { NO_CONFIG_FOUND_MSG } from './hooks/useStdcmEnv';
import useStdcmForm from './hooks/useStdcmForm';

const StdcmViewContent = ({
  isDebugMode,
  stdcmConf,
  showStatusBanner,
  setShowStatusBanner,
}: {
  stdcmConf: OsrdStdcmConfState;
  isDebugMode: boolean;
  showStatusBanner: boolean;
  setShowStatusBanner: Dispatch<SetStateAction<boolean>>;
}) => {
  const currentSimulationInputs = useStdcmForm();
  const simulationsList = useSelector(getStdcmSimulations);
  const completedSimulations = useSelector(getStdcmCompletedSimulations);
  const selectedSimulationIndex = useSelector(getSelectedSimulationIndex);
  const retainedSimulationIndex = useSelector(getRetainedSimulationIndex);

  const [showBtnToLaunchSimulation, setShowBtnToLaunchSimulation] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(true);
  const [skipPathfindingStatusMessage, setSkipPathfindingStatusMessage] = useState(false);
  const [displayInfoMessage, setDisplayInfoMessage] = useState(false);

  const resultSectionRef = useRef<HTMLDivElement | null>(null);
  const previousResultSectionOffsetRef = useRef<number | null>(null);

  const {
    launchStdcmRequest,
    cancelStdcmRequest,
    resetStdcmState,
    isPending,
    isPendingAdditional,
    isRejected,
    isCanceled,
    isCalculationFailed,
    isCalculationCompleted,
  } = useStdcm({ showFailureNotification: false });

  const dispatch = useAppDispatch();

  const handleSelectSimulation = (index: number) => {
    if (retainedSimulationIndex === undefined) {
      if (resultSectionRef.current) {
        previousResultSectionOffsetRef.current =
          resultSectionRef.current.getBoundingClientRect().top;
      }
      dispatch(selectSimulation(index));
      setSkipPathfindingStatusMessage(true);
      setShowBtnToLaunchSimulation(false);
      setDisplayInfoMessage(true);
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

  useEffect(() => {
    setShowBtnToLaunchSimulation(
      selectedSimulationIndex === undefined ||
        !isEqual(currentSimulationInputs, simulationsList[selectedSimulationIndex].inputs)
    );
  }, [currentSimulationInputs, selectedSimulationIndex]);

  useEffect(() => {
    if (isPending || isPendingAdditional) {
      setShowBtnToLaunchSimulation(false);
    }
  }, [isPending, isPendingAdditional]);

  useEffect(() => {
    if (isCanceled) {
      setShowBtnToLaunchSimulation(true);
      setDisplayInfoMessage(true);
    }
  }, [isCanceled]);

  useEffect(() => {
    if (isCalculationCompleted) {
      setShowStatusBanner(true);
      setDisplayInfoMessage(false);
    }
  }, [isCalculationCompleted]);

  useEffect(() => {
    if (isRejected) {
      setShowStatusBanner(true);
    }
  }, [isRejected]);

  useEffect(() => {
    if (completedSimulations.length > 0 && resultSectionRef.current) {
      resultSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [completedSimulations.length]);

  /*
   * After the new content is rendered, this effect adjusts the scroll to compensate for any shift in the stdcmResult section.
   * It compares the stdcmResult section position before the change (stored in previousResultSectionOffsetRef)
   * with its current position after rendering. The calculated difference is used to perform a window.scrollBy,
   *  ensuring that the section remains at the same relative position in the viewport, thus avoiding any visual jump.
   */
  useLayoutEffect(() => {
    if (resultSectionRef.current && previousResultSectionOffsetRef.current) {
      const newOffset = resultSectionRef.current.getBoundingClientRect().top;
      const diff = newOffset - previousResultSectionOffsetRef.current;
      window.scrollBy({ top: diff, behavior: 'auto' });
    }
  }, [selectedSimulationIndex]);

  return (
    <div>
      <StdcmConfig
        isPending={isPending}
        isPendingAdditional={isPendingAdditional}
        isDebugMode={isDebugMode}
        showBtnToLaunchSimulation={showBtnToLaunchSimulation}
        retainedSimulationIndex={retainedSimulationIndex}
        skipPathfindingStatusMessage={skipPathfindingStatusMessage}
        setSkipPathfindingStatusMessage={setSkipPathfindingStatusMessage}
        launchStdcmRequest={launchStdcmRequest}
        cancelStdcmRequest={cancelStdcmRequest}
      />

      {showStatusBanner && <StdcmStatusBanner isFailed={isCalculationFailed} />}

      {completedSimulations.length > 0 && (
        <div ref={resultSectionRef} className="stdcm-results">
          <StdcmResults
            isCalculationFailed={isCalculationFailed}
            isDebugMode={isDebugMode}
            onSelectSimulation={handleSelectSimulation}
            displayInfoMessage={displayInfoMessage}
            onStartNewQuery={handleStartNewQuery}
            onStartNewQueryWithData={handleStartNewQueryWithData}
            buttonsVisible={buttonsVisible}
            showStatusBanner={showStatusBanner}
          />
        </div>
      )}
    </div>
  );
};

const StdcmView = () => {
  const { loading, error, loadStdcmEnvironment, resetStdcmEnvironment } = useStdcmEnvironment();
  const stdcmConf = useSelector(getStdcmConf);

  const [isDebugMode, setIsDebugMode] = useState(false);
  const [showStatusBanner, setShowStatusBanner] = useState(false);
  const [showHelpModule, setShowHelpModule] = useState(false);

  const isStdcmConfValid = useMemo(
    () => !!stdcmConf.searchDatetimeWindow && !!stdcmConf.timetableID && !!stdcmConf.infraID,
    [stdcmConf]
  );

  const toggleHelpModule = useCallback(
    () => setShowHelpModule((show) => !show),
    [setShowHelpModule]
  );

  useEffect(() => {
    if (!isDebugMode) {
      loadStdcmEnvironment();
    }

    return () => {
      resetStdcmEnvironment();
    };
  }, [isDebugMode]);

  // If we've got an error during the loading of the stdcm env which is not the "no config error" message,
  // we let the error boundary manage it
  if (error && error.message !== NO_CONFIG_FOUND_MSG) throw error;

  // When the STDCM environment is being loaded and the conf is not valid, we do not mount the actual STDCM
  // view content yet:
  if (loading)
    return (
      <div role="button" tabIndex={0} className="stdcm" onClick={() => setShowStatusBanner(false)}>
        <StdcmHeader
          isDebugMode={isDebugMode}
          onDebugModeToggle={setIsDebugMode}
          toggleHelpModule={toggleHelpModule}
          showHelpModule={showHelpModule}
        />
        <LoaderFill />
        <StdcmHelpModule showHelpModule={showHelpModule} toggleHelpModule={toggleHelpModule} />
      </div>
    );

  return (
    <div role="button" tabIndex={0} className="stdcm" onClick={() => setShowStatusBanner(false)}>
      <StdcmHeader
        isDebugMode={isDebugMode}
        onDebugModeToggle={setIsDebugMode}
        toggleHelpModule={toggleHelpModule}
        showHelpModule={showHelpModule}
      />

      {!isNil(error) || !isStdcmConfValid ? (
        <StdcmEmptyConfigError />
      ) : (
        <StdcmViewContent
          isDebugMode={isDebugMode}
          stdcmConf={stdcmConf}
          showStatusBanner={showStatusBanner}
          setShowStatusBanner={setShowStatusBanner}
        />
      )}
      <StdcmHelpModule showHelpModule={showHelpModule} toggleHelpModule={toggleHelpModule} />
    </div>
  );
};

export default StdcmView;
