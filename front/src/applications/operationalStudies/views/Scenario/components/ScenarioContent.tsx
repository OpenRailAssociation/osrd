import { useState, useCallback, useRef, useEffect } from 'react';

import { ChevronRight } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import useScenarioData from 'applications/operationalStudies/hooks/useScenarioData';
import type { Board } from 'applications/operationalStudies/types';
import ManageTimetableItemModal from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem';
import SimulationResults from 'applications/operationalStudies/views/Scenario/components/SimulationResults';
import type { Conflict } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import ConflictsList from 'modules/conflict/components/ConflictsList';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import type {
  TimetableItemId,
  TimetableItem,
  TimetableItemToEditData,
  TrainId,
} from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import {
  formatEditoastIdToExceptionId,
  formatEditoastIdToIndexedOccurrenceId,
  formatEditoastIdToTrainScheduleId,
} from 'utils/trainId';

import { MANAGE_TIMETABLE_ITEM_TYPES } from '../consts';
import BoardWrapper from './BoardWrapper';
import { EditedElementContainerProvider } from './EditedElementContainerContext';
import MacroEditorState from './MacroEditor/MacroEditorState';
import { handleOperation } from './MacroEditor/ngeToOsrd';
import { loadNgeDto } from './MacroEditor/osrdToNge';
import NGE from './NGE';
import type { NetzgrafikDto, NGEEvent } from './NGE/types';
import TimetableBoardWrapper from './Timetable/TimetableBoardWrapper';

type ScenarioContentProps = {
  activeBoards: Set<Board>;
};

const MACRO_EDITOR_HEIGHT = 776; // px

const ScenarioContent = ({ activeBoards }: ScenarioContentProps) => {
  const { t, i18n } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const { scenario } = useScenarioContext();

  const { infra, isInfraLoaded } = useScenarioContext();

  const [displayTimetableItemManagement, setDisplayTimetableItemManagement] = useState<string>(
    MANAGE_TIMETABLE_ITEM_TYPES.none
  );
  const [collapsedTimetable, setCollapsedTimetable] = useState(false);
  const [collapsedTimetableEdit, setCollapsedTimetableEdit] = useState(false);
  const [timetableItemToEditData, setTimetableItemToEditData] = useState<TimetableItemToEditData>();
  const {
    timetableItemsWithDetails,
    timetableItems,
    projectionData,
    conflicts,
    isConflictsLoading,
    upsertTimetableItems,
    removeTimetableItems,
    updateTrainDepartureTime,
  } = useScenarioData(scenario, infra);

  const macroEditorState = useRef<MacroEditorState>(null);
  const [ngeDto, setNgeDto] = useState<NetzgrafikDto>();
  const [ngeIsLoading, setNGEIsLoading] = useState(true);

  const refreshNge = useCallback(async () => {
    const state = new MacroEditorState(
      infra.id,
      scenario.id,
      scenario.study_id,
      scenario.project.id
    );
    const dto = await loadNgeDto(state, scenario.timetable_id, dispatch, t);
    macroEditorState.current = state;
    setNgeDto(dto);
  }, [
    dispatch,
    infra.id,
    scenario.study_id,
    scenario.project.id,
    scenario.id,
    scenario.timetable_id,
  ]);

  const upsertTimetableItemsWithNge = useCallback(
    (updatedTimetableItems: TimetableItem[]) => {
      upsertTimetableItems(updatedTimetableItems);
      if (activeBoards.has('macro')) {
        refreshNge();
      }
    },
    [upsertTimetableItems, refreshNge, activeBoards]
  );

  const removeTimetableItemsWithNge = useCallback(
    (timetableItemIds: TimetableItemId[]) => {
      removeTimetableItems(timetableItemIds);
      if (activeBoards.has('macro')) {
        refreshNge();
      }
    },
    [removeTimetableItems, refreshNge, activeBoards]
  );

  // To update dynamic translations in NGE when language changes
  useEffect(() => {
    if (activeBoards.has('macro')) {
      refreshNge();
    }
  }, [i18n.language]);

  useEffect(() => {
    if (activeBoards.has('macro')) {
      setNGEIsLoading(true);
      refreshNge();
    }
  }, [activeBoards.has('macro')]);

  const handleNGEOperation = (event: NGEEvent, netzgrafikDto: NetzgrafikDto) => {
    handleOperation({
      event,
      netzgrafikDto,
      timetableId: scenario.timetable_id,
      infraId: infra.id,
      state: macroEditorState.current!,
      dispatch,
      addUpsertedTimetableItems: upsertTimetableItems,
      addDeletedTimetableItemIds: removeTimetableItems,
    });
  };

  const handleNGELoad = () => setNGEIsLoading(false);

  const handleConflictClick = (conflict: Conflict) => {
    let formattedFirstTrainId: TrainId | undefined;
    if (conflict.train_schedule_ids.length > 0) {
      formattedFirstTrainId = formatEditoastIdToTrainScheduleId(conflict.train_schedule_ids[0]);
    } else {
      const firstPacedTrainOccurrenceId = conflict.paced_train_occurrence_ids[0];
      if ('index' in firstPacedTrainOccurrenceId) {
        formattedFirstTrainId = formatEditoastIdToIndexedOccurrenceId({
          pacedTrainId: firstPacedTrainOccurrenceId.paced_train_id,
          occurrenceIndex: firstPacedTrainOccurrenceId.index,
        });
      } else {
        formattedFirstTrainId = formatEditoastIdToExceptionId({
          pacedTrainId: firstPacedTrainOccurrenceId.paced_train_id,
          exceptionId: firstPacedTrainOccurrenceId.exception_key,
        });
      }
    }
    dispatch(updateSelectedTrainId(formattedFirstTrainId));
  };

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
            {isInfraLoaded && infra && (
              <SimulationResults
                scenarioData={{ name: scenario.name, infraName: scenario.infra_name }}
                projectionData={projectionData}
                conflicts={conflicts}
                timetableItemsWithDetails={timetableItemsWithDetails}
                activeBoards={activeBoards}
                updateTrainDepartureTime={updateTrainDepartureTime}
              />
            )}
            <BoardWrapper hidden={!activeBoards.has('macro')} name="MACRO">
              <div className="osrd-simulation-container">
                <div
                  className="chart-container"
                  style={{
                    height: `${MACRO_EDITOR_HEIGHT}px`,
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
          </div>
        </div>
        <div
          className="right-column"
          data-testid="conflicts-list"
          style={{ display: activeBoards.has('conflicts') ? 'block' : 'none' }}
        >
          <BoardWrapper
            hidden={!activeBoards.has('conflicts')}
            name={t('main.conflictsCount', { count: conflicts?.length ?? 0 })}
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
                <ConflictsList
                  conflicts={conflicts ?? []}
                  timetableItems={timetableItemsWithDetails}
                  onConflictClick={handleConflictClick}
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
