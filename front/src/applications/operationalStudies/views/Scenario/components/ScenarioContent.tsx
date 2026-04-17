import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import useScenarioData from 'applications/operationalStudies/hooks/useScenarioData';
import useScenarioTrainScheduleSet from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import type { Board } from 'applications/operationalStudies/types';
import ManageTrainScheduleModal from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule';
import SimulationResults from 'applications/operationalStudies/views/Scenario/components/SimulationResults';
import { Loader } from 'common/Loaders';
import Conflicts from 'modules/conflict/components/Conflicts';
import useConflictsFilter from 'modules/conflict/hooks/useConflictsFilter';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import { setFailure } from 'reducers/main';
import type { TimetableItem, TrainScheduleToEditData } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { usePrevious } from 'utils/hooks/state';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from '../consts';
import BoardWrapper from './BoardWrapper';
import { EditedElementContainerProvider } from './EditedElementContainerContext';
import MacroEditorState from './MacroEditor/MacroEditorState';
import { handleOperation } from './MacroEditor/ngeToOsrd';
import { loadNgeDto } from './MacroEditor/osrdToNge';
import NGE from './NGE';
import type { NetzgrafikDto, NGEEvent } from './NGE/types';
import { HIDDEN_CHART_TOP_HEIGHT } from './SimulationResults/SimulationResults';
import TimetableBoardWrapper from './Timetable/TimetableBoardWrapper';

type ScenarioContentProps = {
  activeBoards: Set<Board>;
};

const MACRO_EDITOR_HEIGHT = 776; // px
const MACRO_MIN_HEIGHT = 500;

const ScenarioContent = ({ activeBoards }: ScenarioContentProps) => {
  const { t, i18n } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const { scenario, sandboxId } = useScenarioContext();

  const { infraId, timetableId, isInfraLoaded } = useScenarioContext();

  const [displayTrainScheduleManagement, setDisplayTrainScheduleManagement] = useState<string>(
    MANAGE_TRAIN_SCHEDULE_TYPES.none
  );
  const [collapsedTimetableEdit, setCollapsedTimetableEdit] = useState(false);
  const [trainScheduleToEditData, setTrainScheduleToEditData] = useState<TrainScheduleToEditData>();
  const [macroBoardHeight, setMacroBoardHeight] = useState<number>(MACRO_EDITOR_HEIGHT);

  const {
    trainSchedulesWithDetails,
    timetableItems,
    projectionData,
    conflicts,
    isConflictsLoading,
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
  } = useConflictsFilter(
    useMemo(() => timetableItems || [], [timetableItems]),
    conflicts,
    isConflictsLoading
  );

  const macroEditorState = useRef<MacroEditorState>(null);
  const lastNgeOperationPromise = useRef(Promise.resolve());
  const [ngeDto, setNgeDto] = useState<NetzgrafikDto>();
  const [ngeIsLoading, setNGEIsLoading] = useState(true);

  const refreshNge = useCallback(async () => {
    if (!activeBoards.has('macro')) return;
    const state = new MacroEditorState(infraId, scenario.id);

    const dto = await loadNgeDto(state, scenario.timetable_id, dispatch, t);
    macroEditorState.current = state;
    setNgeDto(dto);
    // eslint-disable-next-line react-hooks/use-memo
  }, [dispatch, infraId, scenario.id, scenario.timetable_id, activeBoards.has('macro')]);

  const upsertTrainSchedulesWithNge = useCallback(
    (updatedTrainSchedules: TimetableItem[]) => {
      upsertTrainSchedules(updatedTrainSchedules);
      refreshNge();
    },
    [upsertTrainSchedules, refreshNge]
  );

  const { importTrainScheduleSets } = useScenarioTrainScheduleSet(
    trainSchedulesWithDetails,
    useMemo(() => timetableItems || [], [timetableItems]),
    upsertTrainSchedulesWithNge
  );

  const removeTrainSchedulesWithNge = useCallback(
    (trainScheduleIds: number[]) => {
      removeTrainSchedules(trainScheduleIds);
      refreshNge();
    },
    [removeTrainSchedules, refreshNge]
  );

  const updateTrainScheduleDepartureTimeWithNge = useCallback(
    async (trainScheduleId: number, newDeparture: Date) => {
      await updateTrainScheduleDepartureTime(trainScheduleId, newDeparture);
      refreshNge();
    },
    [updateTrainScheduleDepartureTime, refreshNge]
  );

  const simulationResultBoards = ['map', 'tables', 'std', 'sdd', 'chronogram'] as Board[];
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

  const handleNGEOperation = (event: NGEEvent, netzgrafikDto: NetzgrafikDto) => {
    // Wait for the previous handler to complete before starting the next one
    lastNgeOperationPromise.current = lastNgeOperationPromise.current.then(async () => {
      try {
        await handleOperation({
          event,
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

  return (
    <EditedElementContainerProvider>
      <main className="mastcontainer mastcontainer-no-mastnav scenario scenario-content-v2">
        {displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.none && (
          <ManageTrainScheduleModal
            displayTrainScheduleManagement={displayTrainScheduleManagement}
            setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
            upsertTrainSchedules={upsertTrainSchedulesWithNge}
            trainScheduleToEditData={trainScheduleToEditData}
            setTrainScheduleToEditData={setTrainScheduleToEditData}
            setCollapsedTimetableEdit={() => setCollapsedTimetableEdit(!collapsedTimetableEdit)}
            collapsedTimetableEdit={collapsedTimetableEdit}
            importTrainScheduleSets={importTrainScheduleSets}
          />
        )}
        <div
          data-testid="scenario-left-column"
          className="left-column"
          style={{ display: activeBoards.has('trains') ? 'block' : 'none' }}
        >
          <div className="scenario-sidemenu">
            <TimetableBoardWrapper
              setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
              upsertTrainSchedules={upsertTrainSchedulesWithNge}
              removeTrainSchedules={removeTrainSchedulesWithNge}
              timetableItems={timetableItems}
              trainSchedulesWithDetails={trainSchedulesWithDetails}
              setTrainScheduleToEditData={setTrainScheduleToEditData}
              trainScheduleToEditData={trainScheduleToEditData}
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
          {!isInfraLoaded &&
            displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.add &&
            displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.edit && (
              <ScenarioLoaderMessage />
            )}
          <div className="scenario-results">
            {isInfraLoaded && isBoardSimulationResultsActive && (
              <SimulationResults
                scenarioData={{ name: scenario.name, infraName: scenario.infra_name }}
                projectionData={projectionData}
                conflicts={conflicts}
                trainSchedulesWithDetails={trainSchedulesWithDetails}
                timetableItems={timetableItems ?? []}
                activeBoards={activeBoards}
                updateTrainScheduleDepartureTime={updateTrainScheduleDepartureTimeWithNge}
                upsertTrainSchedules={upsertTrainSchedulesWithNge}
              />
            )}
            {activeBoards.has('macro') && (
              <BoardWrapper
                name="MACRO"
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
                    <NGE dto={ngeDto} onOperation={handleNGEOperation} onLoad={handleNGELoad} />
                  </div>
                </div>
              </BoardWrapper>
            )}
          </div>
        </div>
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
  );
};

export default ScenarioContent;
