import { useState, useCallback, useRef, useEffect } from 'react';

import { ChevronRight } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import useScenarioData from 'applications/operationalStudies/hooks/useScenarioData';
import type { Board } from 'applications/operationalStudies/types';
import ManageTimetableItemModal from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem';
import SimulationResults from 'applications/operationalStudies/views/Scenario/components/SimulationResults';
import { Loader } from 'common/Loaders';
import ResizableSection from 'common/ResizableSection';
import Conflicts from 'modules/conflict/components/Conflicts';
import useConflictsFilter from 'modules/conflict/hooks/useConflictsFilter';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import { setFailure } from 'reducers/main';
import type {
  TimetableItemId,
  TimetableItem,
  TimetableItemToEditData,
} from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { usePrevious } from 'utils/hooks/state';

import { MANAGE_TIMETABLE_ITEM_TYPES } from '../consts';
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
  const { scenario } = useScenarioContext();

  const { infraId, isInfraLoaded } = useScenarioContext();

  const [displayTimetableItemManagement, setDisplayTimetableItemManagement] = useState<string>(
    MANAGE_TIMETABLE_ITEM_TYPES.none
  );
  const [collapsedTimetable, setCollapsedTimetable] = useState(false);
  const [collapsedTimetableEdit, setCollapsedTimetableEdit] = useState(false);
  const [timetableItemToEditData, setTimetableItemToEditData] = useState<TimetableItemToEditData>();
  const [macroBoardHeight, setMacroBoardHeight] = useState<number>(MACRO_EDITOR_HEIGHT);

  const {
    timetableItemsWithDetails,
    timetableItems,
    projectionData,
    conflicts,
    isConflictsLoading,
    upsertTimetableItems,
    removeTimetableItems,
    updateTrainDepartureTime,
  } = useScenarioData(scenario, infraId);

  const {
    showOnlySelectedTrain,
    handleToggleConflictsFilter,
    selectedTrainName,
    totalConflictsCount,
    selectedTrainConflictsCount,
    displayedConflicts,
  } = useConflictsFilter(timetableItems || [], conflicts);

  const macroEditorState = useRef<MacroEditorState>(null);
  const [ngeDto, setNgeDto] = useState<NetzgrafikDto>();
  const [ngeIsLoading, setNGEIsLoading] = useState(true);

  const refreshNge = useCallback(async () => {
    if (!activeBoards.has('macro')) return;
    const state = new MacroEditorState(
      infraId,
      scenario.id,
      scenario.study_id,
      scenario.project.id
    );

    const dto = await loadNgeDto(state, scenario.timetable_id, dispatch, t);
    macroEditorState.current = state;
    setNgeDto(dto);
  }, [
    dispatch,
    infraId,
    scenario.study_id,
    scenario.project.id,
    scenario.id,
    scenario.timetable_id,
    activeBoards.has('macro'),
  ]);

  const upsertTimetableItemsWithNge = useCallback(
    (updatedTimetableItems: TimetableItem[]) => {
      upsertTimetableItems(updatedTimetableItems);
      refreshNge();
    },
    [upsertTimetableItems, refreshNge]
  );

  const removeTimetableItemsWithNge = useCallback(
    (timetableItemIds: TimetableItemId[]) => {
      removeTimetableItems(timetableItemIds);
      refreshNge();
    },
    [removeTimetableItems, refreshNge]
  );

  const updateTrainDepartureTimeWithNge = useCallback(
    async (timetableItemId: TimetableItemId, newDeparture: Date) => {
      await updateTrainDepartureTime(timetableItemId, newDeparture);
      refreshNge();
    },
    [updateTrainDepartureTime, refreshNge]
  );

  // To update dynamic translations in NGE when language changes
  useEffect(() => {
    refreshNge();
  }, [i18n.language]);

  const prevMacroActive = usePrevious(activeBoards.has('macro'));

  useEffect(() => {
    if (activeBoards.has('macro')) {
      if (!prevMacroActive) setNGEIsLoading(true);
      refreshNge();
    }
  }, [activeBoards.has('macro')]);

  const handleNGEOperation = async (event: NGEEvent, netzgrafikDto: NetzgrafikDto) => {
    try {
      await handleOperation({
        event,
        netzgrafikDto,
        timetableId: scenario.timetable_id,
        infraId,
        state: macroEditorState.current!,
        dispatch,
        addUpsertedTimetableItems: upsertTimetableItems,
        addDeletedTimetableItemIds: removeTimetableItems,
      });
    } catch (err) {
      console.error(err);
      dispatch(setFailure(castErrorToFailure(err)));
    }
  };

  const handleNGELoad = () => setNGEIsLoading(false);

  return (
    <EditedElementContainerProvider>
      <main className="mastcontainer mastcontainer-no-mastnav scenario scenario-content-v2">
        {displayTimetableItemManagement !== MANAGE_TIMETABLE_ITEM_TYPES.none && (
          <ManageTimetableItemModal
            displayTimetableItemManagement={displayTimetableItemManagement}
            setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
            upsertTimetableItems={upsertTimetableItemsWithNge}
            removeTimetableItems={removeTimetableItemsWithNge}
            timetableItemToEditData={timetableItemToEditData}
            setTimetableItemToEditData={setTimetableItemToEditData}
            setCollapsedTimetableEdit={() => setCollapsedTimetableEdit(!collapsedTimetableEdit)}
            collapsedTimetableEdit={collapsedTimetableEdit}
          />
        )}
        <div
          data-testid="scenario-left-column"
          className="left-column"
          style={{ display: activeBoards.has('trains') ? 'block' : 'none' }}
        >
          <div className="scenario-sidemenu">
            <TimetableBoardWrapper
              setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
              upsertTimetableItems={upsertTimetableItemsWithNge}
              removeTimetableItems={removeTimetableItemsWithNge}
              timetableItems={timetableItems}
              timetableItemsWithDetails={timetableItemsWithDetails}
              setTimetableItemToEditData={setTimetableItemToEditData}
              timetableItemToEditData={timetableItemToEditData}
              refreshNge={refreshNge}
              projectingOnSimulatedPathException={
                projectionData?.projectingOnSimulatedPathException
              }
            />
          </div>
        </div>
        <div className="center-column">
          {collapsedTimetable && (
            <button
              data-testid="timetable-collapse-button"
              className="timetable-collapse-button"
              type="button"
              aria-label={t('main.toggleTimetable')}
              onClick={() => setCollapsedTimetable(false)}
            >
              <ChevronRight />
            </button>
          )}
          {!isInfraLoaded &&
            displayTimetableItemManagement !== MANAGE_TIMETABLE_ITEM_TYPES.add &&
            displayTimetableItemManagement !== MANAGE_TIMETABLE_ITEM_TYPES.edit && (
              <ScenarioLoaderMessage />
            )}
          <div className="scenario-results">
            {isInfraLoaded && (
              <SimulationResults
                scenarioData={{ name: scenario.name, infraName: scenario.infra_name }}
                projectionData={projectionData}
                conflicts={conflicts}
                timetableItemsWithDetails={timetableItemsWithDetails}
                activeBoards={activeBoards}
                updateTrainDepartureTime={updateTrainDepartureTimeWithNge}
              />
            )}
            {activeBoards.has('macro') && (
              <ResizableSection
                height={macroBoardHeight}
                setHeight={setMacroBoardHeight}
                minHeight={MACRO_MIN_HEIGHT}
              >
                <BoardWrapper name="MACRO">
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
              </ResizableSection>
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
              {isConflictsLoading ? (
                <Loader
                  msg={t('main.loadingConflicts')}
                  className="scenario-loader"
                  childClass="scenario-loader-msg"
                />
              ) : (
                <Conflicts
                  showOnlySelectedTrain={showOnlySelectedTrain}
                  onToggleFilter={handleToggleConflictsFilter}
                  selectedTrainName={selectedTrainName}
                  conflictsCount={selectedTrainConflictsCount}
                  displayedConflicts={displayedConflicts}
                />
              )}
            </div>
          </BoardWrapper>
        </div>
      </main>
    </EditedElementContainerProvider>
  );
};

export default ScenarioContent;
