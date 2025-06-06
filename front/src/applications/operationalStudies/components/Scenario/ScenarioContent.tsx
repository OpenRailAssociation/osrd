import { useState, useCallback, useRef, useEffect } from 'react';

import { ChevronRight } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import { handleOperation } from 'applications/operationalStudies/components/MacroEditor/ngeToOsrd';
import {
  loadAndIndexNge,
  getNgeDto,
} from 'applications/operationalStudies/components/MacroEditor/osrdToNge';
import type { NetzgrafikDto, NGEEvent } from 'applications/operationalStudies/components/NGE/types';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import useScenarioData from 'applications/operationalStudies/hooks/useScenarioData';
import ManageTrainScheduleModal from 'applications/operationalStudies/views/ManageTrainScheduleModal';
import SimulationResults from 'applications/operationalStudies/views/SimulationResults';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { Conflict, InfraWithState, ScenarioResponse } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import ConflictsList from 'modules/conflict/components/ConflictsList';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import Timetable from 'modules/trainschedule/components/Timetable';
import type {
  TimetableItemId,
  TimetableItem,
  TimetableItemToEditData,
} from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { formatEditoastIdToPacedTrainId, formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import MacroEditorState from '../MacroEditor/MacroEditorState';
import MicroMacroSwitch from '../MicroMacroSwitch';
import NGE from '../NGE';
import { EditedElementContainerProvider } from './EditedElementContainerContext';

type ScenarioContentProps = {
  scenario: ScenarioResponse;
  infra: InfraWithState;
  infraMetadata: { isInfraLoaded: boolean; reloadCount: number };
  isTimetableDisplayed?: boolean;
  isConflictsListDisplayed?: boolean;
};

const ScenarioContent = ({
  scenario,
  infra,
  infraMetadata: { isInfraLoaded },
  isTimetableDisplayed,
  isConflictsListDisplayed,
}: ScenarioContentProps) => {
  const { t, i18n } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();

  const [displayTrainScheduleManagement, setDisplayTrainScheduleManagement] = useState<string>(
    MANAGE_TRAIN_SCHEDULE_TYPES.none
  );
  const [collapsedTimetable, setCollapsedTimetable] = useState(false);
  const [timetableItemToEditData, setTimetableItemToEditData] = useState<TimetableItemToEditData>();
  const [isMacro, setIsMacro] = useState(false);
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
    const state = new MacroEditorState(scenario, [...trainSchedules, ...pacedTrains]);
    await loadAndIndexNge(state, dispatch, t);
    const dto = getNgeDto(state);
    macroEditorState.current = state;
    setNgeDto(dto);
  }, [dispatch, scenario, scenario.timetable_id]);

  const upsertTimetableItemsWithNge = useCallback(
    (updatedTimetableItems: TimetableItem[]) => {
      upsertTimetableItems(updatedTimetableItems);
      if (isMacro) {
        refreshNge();
      }
    },
    [upsertTimetableItems, refreshNge, isMacro]
  );

  const removeTimetableItemsWithNge = useCallback(
    (timetableItemIds: TimetableItemId[]) => {
      removeTimetableItems(timetableItemIds);
      if (isMacro) {
        refreshNge();
      }
    },
    [removeTimetableItems, refreshNge, isMacro]
  );

  // To update dynamic translations in NGE when language changes
  useEffect(() => {
    if (isMacro) {
      refreshNge();
    }
  }, [i18n.language]);

  const toggleMicroMacroButton = useCallback(
    (isMacroMode: boolean) => {
      setIsMacro(isMacroMode);
      if (!isMacroMode && collapsedTimetable) {
        setCollapsedTimetable(false);
      }
      if (!isMacro && isMacroMode) {
        setNGEIsLoading(true);
        refreshNge();
      }
    },
    [isMacro, setIsMacro, collapsedTimetable]
  );

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
        {displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.none && (
          <ManageTrainScheduleModal
            displayTrainScheduleManagement={displayTrainScheduleManagement}
            setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
            upsertTimetableItems={upsertTimetableItemsWithNge}
            removeTimetableItems={removeTimetableItemsWithNge}
            infraState={infra.state}
            timetableItemToEditData={timetableItemToEditData}
            setTimetableItemToEditData={setTimetableItemToEditData}
            scenario={scenario}
          />
        )}
        <div
          data-testid="scenario-left-column"
          className="left-column"
          style={{ display: isTimetableDisplayed ? 'block' : 'none' }}
        >
          <div className="scenario-sidemenu">
            <MicroMacroSwitch isMacro={isMacro} setIsMacro={toggleMicroMacroButton} />

            {infra && (
              <Timetable
                setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
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
            !isMacro &&
            displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.add &&
            displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.edit && (
              <ScenarioLoaderMessage infraState={infra?.state} />
            )}
          {isMacro && (!ngeDto || ngeIsLoading) && (
            <Loader
              msg={t('main.loadingMacroEditor')}
              className="scenario-loader"
              childClass="scenario-loader-msg"
            />
          )}
          <div className="scenario-results">
            {isMacro ? (
              <div className="h-100 p-1">
                <NGE dto={ngeDto} onOperation={handleNGEOperation} onLoad={handleNGELoad} />
              </div>
            ) : (
              isInfraLoaded && (
                <SimulationResults
                  scenarioData={{ name: scenario.name, infraName: scenario.infra_name }}
                  projectionData={projectionData}
                  conflicts={conflicts}
                  timetableItemsWithDetails={timetableItemsWithDetails}
                  updateTrainDepartureTime={updateTrainDepartureTime}
                />
              )
            )}
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
