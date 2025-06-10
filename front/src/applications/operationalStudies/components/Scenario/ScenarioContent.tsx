import { useState, useCallback, useRef, useEffect } from 'react';

import { ChevronRight } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import handleOperation from 'applications/operationalStudies/components/MacroEditor/ngeToOsrd';
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
import i18n from 'i18n';
import ConflictsList from 'modules/conflict/components/ConflictsList';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import Timetable from 'modules/trainschedule/components/Timetable';
import useFilterTimetableItems from 'modules/trainschedule/components/Timetable/useFilterTimetableItems';
import type { TimetableItemId, TimetableItem } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { formatEditoastIdToPacedTrainId, formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import MacroEditorState from '../MacroEditor/MacroEditorState';
import MicroMacroSwitch from '../MicroMacroSwitch';
import NGE from '../NGE';
import BoardWrapper from './BoardWrapper';
import { use } from 'i18next';

type ScenarioContentProps = {
  scenario: ScenarioResponse;
  infra: InfraWithState;
  infraMetadata: { isInfraLoaded: boolean; reloadCount: number };
  isTimetableDisplay?: boolean;
  isConflictsListDisplay?: boolean;
  isMacroEditorDisplay?: boolean;
};

const MACRO_EDITOR_HEIGHT = 776; // px

const ScenarioContent = ({
  scenario,
  infra,
  infraMetadata: { isInfraLoaded },
  isTimetableDisplay,
  isConflictsListDisplay,
  isMacroEditorDisplay,
}: ScenarioContentProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dispatch = useAppDispatch();

  const [displayTrainScheduleManagement, setDisplayTrainScheduleManagement] = useState<string>(
    MANAGE_TRAIN_SCHEDULE_TYPES.none
  );
  const [collapsedTimetable, setCollapsedTimetable] = useState(false);
  const [itemIdToEdit, setItemIdToEdit] = useState<TimetableItemId>();
  // const [isMacro, setIsMacro] = useState(false);
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
      if (isMacroEditorDisplay) {
        refreshNge();
      }
    },
    [upsertTimetableItems, refreshNge, isMacroEditorDisplay]
  );

  const removeTimetableItemsWithNge = useCallback(
    (timetableItemIds: TimetableItemId[]) => {
      removeTimetableItems(timetableItemIds);
      if (isMacroEditorDisplay) {
        refreshNge();
      }
    },
    [removeTimetableItems, refreshNge, isMacroEditorDisplay]
  );
  const { filteredTimetableItems } = useFilterTimetableItems(timetableItemsWithDetails);

  // To update dynamic translations in NGE when language changes
  useEffect(() => {
    if (isMacroEditorDisplay) {
      refreshNge();
    }
  }, [i18n.language]);

  useEffect(() => {
    if (isMacroEditorDisplay) {
      setNGEIsLoading(true);
      refreshNge();
    }
  }, [isMacroEditorDisplay, refreshNge]);

  // const toggleMicroMacroButton = useCallback(
  //   (isMacroMode: boolean) => {
  //     setIsMacro(isMacroMode);
  //     if (!isMacroMode && collapsedTimetable) {
  //       setCollapsedTimetable(false);
  //     }
  //     if (!isMacroEditorDisplay && isMacroMode) {
  //       setNGEIsLoading(true);
  //       refreshNge();
  //     }
  //   },
  //   [isMacroEditorDisplay, setIsMacro, collapsedTimetable]
  // );

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
    <main className="mastcontainer mastcontainer-no-mastnav scenario scenario-content-v2">
      {displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.none && (
        <ManageTrainScheduleModal
          displayTrainScheduleManagement={displayTrainScheduleManagement}
          setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
          upsertTimetableItems={upsertTimetableItemsWithNge}
          removeTimetableItems={removeTimetableItemsWithNge}
          itemIdToEdit={itemIdToEdit}
          setItemIdToEdit={setItemIdToEdit}
          infraState={infra.state}
          timetableId={scenario.timetable_id}
        />
      )}
      <div
        data-testid="scenario-side-menu"
        className="left-column"
        style={{ display: isTimetableDisplay ? 'block' : 'none' }}
      >
        <div className="scenario-sidemenu">
          {/* <MicroMacroSwitch isMacro={isMacro} setIsMacro={toggleMicroMacroButton} /> */}

          {infra && (
            <Timetable
              setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
              infraState={infra.state}
              upsertTimetableItems={upsertTimetableItemsWithNge}
              removeTimetableItems={removeTimetableItemsWithNge}
              setItemIdToEdit={setItemIdToEdit}
              itemIdToEdit={itemIdToEdit}
              timetableItems={timetableItems}
              timetableItemsWithDetails={timetableItemsWithDetails}
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
            aria-label={t('toggleTimetable')}
            onClick={() => setCollapsedTimetable(false)}
          >
            <ChevronRight />
          </button>
        )}
        {!isInfraLoaded &&
          displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.add &&
          displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.edit && (
            <ScenarioLoaderMessage infraState={infra?.state} />
          )}
        <div className="scenario-results">
          {isInfraLoaded && infra && (
            <SimulationResults
              scenarioData={{ name: scenario.name, infraName: scenario.infra_name }}
              projectionData={projectionData}
              infraId={infra.id}
              conflicts={conflicts}
              timetableItemsWithDetails={timetableItemsWithDetails}
              updateTrainDepartureTime={updateTrainDepartureTime}
            />
          )}
          <BoardWrapper visible={isMacroEditorDisplay!} name="MACRO">
            <div className="osrd-simulation-container speedspacechart-container">
              <div
                className="chart-container"
                style={{
                  height: `560px`,
                }}
              >
                {isMacroEditorDisplay && (!ngeDto || ngeIsLoading) && (
                  <Loader
                    msg={t('loadingMacroEditor')}
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
      {/* TODO : add right column */}
      <div style={{ display: isConflictsListDisplay ? 'block' : 'none' }} className="right-column">
        {conflicts && (
          <ConflictsList
            conflicts={conflicts}
            timetableItems={filteredTimetableItems}
            onConflictClick={() => handleConflictClick}
          />
        )}
      </div>
    </main>
  );
};

export default ScenarioContent;
