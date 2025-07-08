import { useState, useCallback, useRef, useEffect } from 'react';

import { ChevronRight } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import { handleOperation } from 'applications/operationalStudies/components/MacroEditor/ngeToOsrd';
import {
  loadAndIndexNge,
  getNgeDto,
} from 'applications/operationalStudies/components/MacroEditor/osrdToNge';
import type { NetzgrafikDto, NGEEvent } from 'applications/operationalStudies/components/NGE/types';
import { MANAGE_TIMETABLE_ITEM_TYPES } from 'applications/operationalStudies/consts';
import useScenarioData from 'applications/operationalStudies/hooks/useScenarioData';
import ManageTimetableItemModal from 'applications/operationalStudies/views/ManageTimetableItemModal';
import SimulationResults from 'applications/operationalStudies/views/SimulationResults';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { Conflict, InfraWithState, ScenarioResponse } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import ConflictsList from 'modules/conflict/components/ConflictsList';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import Timetable from 'modules/timetableItem/components/Timetable';
import type {
  TimetableItemId,
  TimetableItem,
  TimetableItemToEditData,
} from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { formatEditoastIdToPacedTrainId, formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import MacroEditorState from '../MacroEditor/MacroEditorState';
import NGE from '../NGE';
import BoardWrapper from './BoardWrapper';
import { EditedElementContainerProvider } from './EditedElementContainerContext';

type ScenarioContentProps = {
  scenario: ScenarioResponse;
  infra: InfraWithState;
  infraMetadata: { isInfraLoaded: boolean; reloadCount: number };
  isTimetableDisplayed?: boolean;
  isConflictsListDisplayed?: boolean;
  isMacroEditorDisplayed?: boolean;
};

const MACRO_EDITOR_HEIGHT = 776; // px

const ScenarioContent = ({
  scenario,
  infra,
  infraMetadata: { isInfraLoaded },
  isTimetableDisplayed,
  isConflictsListDisplayed,
  isMacroEditorDisplayed,
}: ScenarioContentProps) => {
  const { t, i18n } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();

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
    upsertTimetableItems,
    removeTimetableItems,
    updateTrainDepartureTime,
  } = useScenarioData(scenario, infra);

  const macroEditorState = useRef<MacroEditorState>();
  const [ngeDto, setNgeDto] = useState<NetzgrafikDto>();
  const [ngeIsLoading, setNGEIsLoading] = useState(true);

  const refreshNge = useCallback(async () => {
    const trainSchedulesPromise = dispatch(
      osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.initiate(
        { timetableId: scenario?.timetable_id },
        { forceRefetch: true, subscribe: false }
      )
    );
    const trainSchedules = (await trainSchedulesPromise.unwrap())
      .filter((trainSchedule) => trainSchedule.path.length >= 2)
      .map((trainSchedule) => ({
        ...trainSchedule,
        id: formatEditoastIdToTrainScheduleId(trainSchedule.id),
      }));
    const pacedTrainsPromise = dispatch(
      osrdEditoastApi.endpoints.getAllTimetableByIdPacedTrains.initiate(
        { timetableId: scenario?.timetable_id },
        { forceRefetch: true, subscribe: false }
      )
    );
    const pacedTrains = (await pacedTrainsPromise.unwrap())
      .filter((pacedTrain) => pacedTrain.path.length >= 2)
      .map((pacedTrain) => ({
        ...pacedTrain,
        id: formatEditoastIdToPacedTrainId(pacedTrain.id),
      }));
    const state = new MacroEditorState(
      infra.id,
      scenario.id,
      scenario.study_id,
      scenario.project.id
    );
    const ngeTimetableItems = [...trainSchedules, ...pacedTrains];
    await loadAndIndexNge(state, ngeTimetableItems, dispatch, t);
    const dto = getNgeDto(state, ngeTimetableItems);
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
      if (isMacroEditorDisplayed) {
        refreshNge();
      }
    },
    [upsertTimetableItems, refreshNge, isMacroEditorDisplayed]
  );

  const removeTimetableItemsWithNge = useCallback(
    (timetableItemIds: TimetableItemId[]) => {
      removeTimetableItems(timetableItemIds);
      if (isMacroEditorDisplayed) {
        refreshNge();
      }
    },
    [removeTimetableItems, refreshNge, isMacroEditorDisplayed]
  );

  // To update dynamic translations in NGE when language changes
  useEffect(() => {
    if (isMacroEditorDisplayed) {
      refreshNge();
    }
  }, [i18n.language]);

  useEffect(() => {
    if (isMacroEditorDisplayed) {
      setNGEIsLoading(true);
      refreshNge();
    }
  }, [isMacroEditorDisplayed]);

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
    if (conflict.train_schedule_ids.length > 0) {
      // TODO Paced train : Adapt this to handle paced trains in conflict issue
      const formattedFirstTrainId = formatEditoastIdToTrainScheduleId(
        conflict.train_schedule_ids[0]
      );
      dispatch(updateSelectedTrainId(formattedFirstTrainId));
    }
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
            infraState={infra.state}
            timetableItemToEditData={timetableItemToEditData}
            setTimetableItemToEditData={setTimetableItemToEditData}
            scenario={scenario}
            setCollapsedTimetableEdit={() => setCollapsedTimetableEdit(!collapsedTimetableEdit)}
            collapsedTimetableEdit={collapsedTimetableEdit}
          />
        )}
        <div
          data-testid="scenario-left-column"
          className="left-column"
          style={{ display: isTimetableDisplayed ? 'block' : 'none' }}
        >
          <div className="scenario-sidemenu">
            {infra && (
              <Timetable
                setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
                infraState={infra.state}
                upsertTimetableItems={upsertTimetableItemsWithNge}
                removeTimetableItems={removeTimetableItemsWithNge}
                timetableItems={timetableItems}
                timetableItemsWithDetails={timetableItemsWithDetails}
                setTimetableItemToEditData={setTimetableItemToEditData}
                timetableItemToEditData={timetableItemToEditData}
              />
            )}
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
              <ScenarioLoaderMessage infraState={infra?.state} />
            )}
          <div className="scenario-results">
            {isInfraLoaded && infra && (
              <SimulationResults
                scenarioData={{ name: scenario.name, infraName: scenario.infra_name }}
                projectionData={projectionData}
                conflicts={conflicts}
                timetableItemsWithDetails={timetableItemsWithDetails}
                updateTrainDepartureTime={updateTrainDepartureTime}
              />
            )}
            <BoardWrapper visible={isMacroEditorDisplayed!} name="MACRO">
              <div className="osrd-simulation-container speedspacechart-container">
                <div
                  className="chart-container"
                  style={{
                    height: `${MACRO_EDITOR_HEIGHT}px`,
                  }}
                >
                  {isMacroEditorDisplayed && (!ngeDto || ngeIsLoading) && (
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
          style={{ display: isConflictsListDisplayed ? 'block' : 'none' }}
          className="right-column"
          data-testid="conflicts-list"
        >
          {conflicts && (
            <ConflictsList
              conflicts={conflicts}
              timetableItems={timetableItemsWithDetails}
              onConflictClick={handleConflictClick}
            />
          )}
        </div>
      </main>
    </EditedElementContainerProvider>
  );
};

export default ScenarioContent;
