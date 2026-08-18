import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { NetzgrafikDto, Operation } from '@osrd-project/netzgrafik-frontend';
import { useTranslation } from 'react-i18next';

import {
  ItineraryModalContext,
  type ItineraryModalContextType,
  type TrainScheduleToEditData,
} from 'applications/operationalStudies/hooks/useItineraryModalContext';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import useScenarioData from 'applications/operationalStudies/hooks/useScenarioData';
import {
  TimetableContext,
  type TimetableContextType,
} from 'applications/operationalStudies/hooks/useTimetableContext';
import type { Board } from 'applications/operationalStudies/types';
import SimulationResults from 'applications/operationalStudies/views/Scenario/components/SimulationResults';
import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import Conflicts from 'modules/conflict/components/Conflicts';
import useConflictsFilter from 'modules/conflict/hooks/useConflictsFilter';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import ChronogramWrapper from 'modules/simulationResult/components/Chronogram/ChronogramWrapper';
import type { PanelSelectionMode } from 'modules/simulationResult/components/SpaceTimeChartWrapper/CurveSelectionSidePanel';
import { setFailure } from 'reducers/main';
import type { TrainId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';
import { usePrevious } from 'utils/hooks/state';

import BoardWrapper from './BoardWrapper';
import { EditedElementContainerProvider } from './EditedElementContainerContext';
import MacroEditorState from './MacroEditor/MacroEditorState';
import { handleOperation } from './MacroEditor/ngeToOsrd';
import { loadNgeDto } from './MacroEditor/osrdToNge';
import ItineraryModal from './ManageTrainSchedule/Itinerary/ItineraryModal';
import NGE from './NGE';
import { HIDDEN_CHART_TOP_HEIGHT } from './SimulationResults/SimulationResults';
import TimetableBoardWrapper from './Timetable/TimetableBoardWrapper';
import { computeLatestMidnight } from './Timetable/utils';

type ScenarioContentProps = {
  activeBoards: Set<Board>;
  toggleBoard: (board: Board) => void;
};

const MACRO_EDITOR_HEIGHT = 776; // px
const MACRO_MIN_HEIGHT = 500;
const CHRONOGRAM_INITIAL_HEIGHT = 492;
const CHRONOGRAM_MIN_HEIGHT = 398;

const ScenarioContent = ({ activeBoards, toggleBoard }: ScenarioContentProps) => {
  const { t, i18n } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const { scenario, sandboxId } = useScenarioContext();

  const { infraId, timetableId, isInfraLoaded } = useScenarioContext();

  const [trainScheduleToEditData, setTrainScheduleToEditData] = useState<TrainScheduleToEditData>();
  const [macroBoardHeight, setMacroBoardHeight] = useState<number>(MACRO_EDITOR_HEIGHT);
  const [chronogramHeight, setChronogramHeight] = useState<number>(CHRONOGRAM_INITIAL_HEIGHT);
  const [itineraryModalOpen, setItineraryModalOpen] = useState<boolean>(false);

  const itineraryModalContext = useMemo(
    (): ItineraryModalContextType => ({
      openItineraryModalToCreate() {
        setTrainScheduleToEditData(undefined);
        setItineraryModalOpen(true);
      },
      openItineraryModalToEdit(editData) {
        setTrainScheduleToEditData(editData);
        setItineraryModalOpen(true);
      },
      closeItineraryModal() {
        setItineraryModalOpen(false);
        setTrainScheduleToEditData(undefined);
      },
      isItineraryModalOpen: itineraryModalOpen,
      trainScheduleToEditData,
    }),
    [itineraryModalOpen, setItineraryModalOpen, trainScheduleToEditData, setTrainScheduleToEditData]
  );

  const {
    trainSchedulesWithDetails,
    trainSchedulesById,
    projectionData,
    conflicts,
    isConflictsLoading,
    hourlyTimetableDuration,
    upsertTrainSchedules,
    removeTrainSchedules,
    updateTrainScheduleDepartureTime,
    selectedTrainScheduleIds,
    setSelectedTrainScheduleIds,
  } = useScenarioData(scenario, infraId, timetableId);

  const {
    showOnlySelectedTrain,
    handleToggleConflictsFilter,
    selectedTrainName,
    totalConflictsCount,
    selectedTrainConflictsCount,
    displayedConflicts,
  } = useConflictsFilter(trainSchedulesById, conflicts, isConflictsLoading);

  const macroEditorState = useRef<MacroEditorState>(null);
  const lastNgeOperationPromise = useRef(Promise.resolve());
  const [ngeDto, setNgeDto] = useState<NetzgrafikDto>();
  const [ngeIsLoading, setNGEIsLoading] = useState(true);
  const [isScrollingToTimeStopsTable, setIsScrollingToTimeStopsTable] = useState(false);

  const openAndScrollToTableBoard = useCallback(() => {
    if (!activeBoards.has('table')) {
      toggleBoard('table');
    }
    setIsScrollingToTimeStopsTable(true);
  }, [activeBoards, toggleBoard]);

  const refreshNge = useCallback(async () => {
    if (!activeBoards.has('macro')) return;
    const state = new MacroEditorState(infraId, scenario.id, scenario.timetable_type);

    const dto = await loadNgeDto(state, scenario.timetable_id, dispatch, t);
    macroEditorState.current = state;
    setNgeDto(dto);
  }, [
    dispatch,
    infraId,
    scenario.id,
    scenario.timetable_id,
    scenario.timetable_type,
    // eslint-disable-next-line react/use-memo
    activeBoards.has('macro'),
  ]);

  const upsertTrainSchedulesWithNge = useCallback(
    (updatedTrainSchedules: TrainScheduleResponse[]) => {
      upsertTrainSchedules(updatedTrainSchedules);
      refreshNge();
    },
    [upsertTrainSchedules, refreshNge]
  );

  const removeTrainSchedulesWithNge = useCallback(
    (trainScheduleIds: number[]) => {
      removeTrainSchedules(trainScheduleIds);
      refreshNge();
    },
    [removeTrainSchedules, refreshNge]
  );

  const updateTrainScheduleDepartureTimeWithNge = useCallback(
    async (
      draggedTrainId: TrainId,
      newDeparture: Date,
      panelSelectionMode?: PanelSelectionMode
    ) => {
      await updateTrainScheduleDepartureTime(draggedTrainId, newDeparture, panelSelectionMode);
      refreshNge();
    },
    [updateTrainScheduleDepartureTime, refreshNge]
  );

  const timetableContext = useMemo(
    (): TimetableContextType => ({
      trainSchedules: trainSchedulesById,
      upsertTrainSchedules: upsertTrainSchedulesWithNge,
      removeTrainSchedules: removeTrainSchedulesWithNge,
      updateTrainScheduleDepartureTime: updateTrainScheduleDepartureTimeWithNge,
    }),
    [
      trainSchedulesById,
      upsertTrainSchedulesWithNge,
      removeTrainSchedulesWithNge,
      updateTrainScheduleDepartureTimeWithNge,
    ]
  );

  const simulationResultBoards: Board[] = ['std', 'table', 'sdd', 'map'];
  const isBoardSimulationResultsActive = simulationResultBoards.some((board) =>
    activeBoards.has(board)
  );

  const prevMacroActive = usePrevious(activeBoards.has('macro'));

  useEffect(() => {
    if (activeBoards.has('macro')) {
      if (!prevMacroActive) setNGEIsLoading(true);
      refreshNge();
    }
  }, [activeBoards.has('macro'), i18n.language, refreshNge]);

  const handleNGEOperation = (operation: Operation, netzgrafikDto: NetzgrafikDto) => {
    // Wait for the previous handler to complete before starting the next one
    lastNgeOperationPromise.current = lastNgeOperationPromise.current.then(async () => {
      try {
        await handleOperation({
          operation,
          netzgrafikDto,
          trainScheduleSetId: sandboxId,
          infraId,
          state: macroEditorState.current!,
          dispatch,
          addUpsertedTrainSchedules: upsertTrainSchedules,
          addDeletedTrainScheduleIds: removeTrainSchedules,
        });
      } catch (err) {
        console.error(err);
        dispatch(setFailure(castErrorToFailure(err)));
      }
    });
  };

  const handleNGELoad = () => setNGEIsLoading(false);

  const defaultStartTime = useMemo(
    () =>
      scenario.timetable_type === 'CALENDAR'
        ? computeLatestMidnight([...trainSchedulesById.values()], new Date())
        : Duration.zero,
    [scenario.timetable_type, trainSchedulesById]
  );

  return (
    <TimetableContext.Provider value={timetableContext}>
      <ItineraryModalContext.Provider value={itineraryModalContext}>
        <EditedElementContainerProvider>
          <main className="mastcontainer mastcontainer-no-mastnav scenario scenario-content-v2">
            {itineraryModalOpen && (
              <ItineraryModal
                onTrainCreated={openAndScrollToTableBoard}
                trainScheduleToEditData={trainScheduleToEditData}
                defaultStartTime={defaultStartTime}
              />
            )}
            <div
              data-testid="scenario-left-column"
              className="left-column"
              style={{ display: activeBoards.has('trains') ? 'block' : 'none' }}
            >
              <div className="scenario-sidemenu">
                <TimetableBoardWrapper
                  trainSchedulesWithDetails={trainSchedulesWithDetails}
                  refreshNge={refreshNge}
                  projectingOnSimulatedPathException={
                    projectionData?.projectingOnSimulatedPathException
                  }
                  selectedTrainScheduleIds={selectedTrainScheduleIds}
                  setSelectedTrainScheduleIds={setSelectedTrainScheduleIds}
                />
              </div>
            </div>
            <div className="center-column">
              {!isInfraLoaded && !itineraryModalOpen && <ScenarioLoaderMessage />}
              <div className="scenario-results">
                {/* STD / TABLES / SDD / MAP */}
                {isInfraLoaded && isBoardSimulationResultsActive && (
                  <SimulationResults
                    scenarioData={{ name: scenario.name, infraName: scenario.infra_name }}
                    projectionData={projectionData}
                    conflicts={conflicts}
                    trainSchedulesWithDetails={trainSchedulesWithDetails}
                    activeBoards={activeBoards}
                    hourlyTimetableDuration={hourlyTimetableDuration}
                    isScrollingToTimeStopsTable={isScrollingToTimeStopsTable}
                    setIsScrollingToTimeStopsTable={setIsScrollingToTimeStopsTable}
                  />
                )}
                {/* MACRO */}
                {activeBoards.has('macro') && (
                  <BoardWrapper
                    name={t('boards.macro')}
                    resizable={{
                      height: macroBoardHeight,
                      setHeight: setMacroBoardHeight,
                      minHeight: MACRO_MIN_HEIGHT,
                    }}
                  >
                    <div className="osrd-simulation-container">
                      <div
                        data-testid="macro-editor"
                        className="chart-container"
                        style={{
                          height: `${macroBoardHeight - HIDDEN_CHART_TOP_HEIGHT}px`,
                        }}
                      >
                        {(!ngeDto || ngeIsLoading) && (
                          <Loader
                            msg={t('main.loadingMacroEditor')}
                            className="scenario-loader"
                            childClass="scenario-loader-msg"
                          />
                        )}
                        <NGE
                          activeFilterSettingId={ngeDto?.filterData.filterSettings.at(0)?.id}
                          dto={ngeDto}
                          onOperation={handleNGEOperation}
                          onLoad={handleNGELoad}
                        />
                      </div>
                    </div>
                  </BoardWrapper>
                )}
                {/* CHRONOGRAM */}
                {isInfraLoaded && trainSchedulesWithDetails.length > 0 && (
                  <BoardWrapper
                    hidden={!activeBoards.has('chronogram')}
                    name={t('boards.chronogram')}
                    resizable={{
                      height: chronogramHeight,
                      setHeight: setChronogramHeight,
                      minHeight: CHRONOGRAM_MIN_HEIGHT,
                    }}
                    withFooter
                  >
                    <div data-testid="chronogram" className="simulation-chronogram">
                      <ChronogramWrapper
                        timetableId={timetableId}
                        trainSchedulesWithDetails={trainSchedulesWithDetails}
                        chronogramHeight={chronogramHeight}
                      />
                    </div>
                  </BoardWrapper>
                )}
              </div>
            </div>
            {/* CONFLICTS */}
            <div
              className="right-column"
              data-testid="conflicts-list"
              style={{ display: activeBoards.has('conflicts') ? 'block' : 'none' }}
            >
              <BoardWrapper
                hidden={!activeBoards.has('conflicts')}
                name={t('main.conflicts.conflictsCount', { count: totalConflictsCount })}
                withFooter
              >
                <div className="conflicts-wrapper">
                  {isConflictsLoading && (
                    <Loader
                      msg={t('main.loadingConflicts')}
                      className="scenario-loader"
                      childClass="scenario-loader-msg"
                    />
                  )}
                  <Conflicts
                    showOnlySelectedTrain={showOnlySelectedTrain}
                    onToggleFilter={handleToggleConflictsFilter}
                    selectedTrainName={selectedTrainName}
                    conflictsCount={selectedTrainConflictsCount}
                    displayedConflicts={displayedConflicts}
                  />
                </div>
              </BoardWrapper>
            </div>
          </main>
        </EditedElementContainerProvider>
      </ItineraryModalContext.Provider>
    </TimetableContext.Provider>
  );
};

export default ScenarioContent;
