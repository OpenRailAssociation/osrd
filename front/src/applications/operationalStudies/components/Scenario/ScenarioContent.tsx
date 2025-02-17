import { useState, useCallback, useEffect, useRef } from 'react';

import { ChevronRight } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import handleOperation from 'applications/operationalStudies/components/MacroEditor/ngeToOsrd';
import {
  loadAndIndexNge,
  getNgeDto,
} from 'applications/operationalStudies/components/MacroEditor/osrdToNge';
import MicroMacroSwitch from 'applications/operationalStudies/components/MicroMacroSwitch';
import NGE from 'applications/operationalStudies/components/NGE/NGE';
import type { NetzgrafikDto, NGEEvent } from 'applications/operationalStudies/components/NGE/types';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { ManageTrainScheduleContextProvider } from 'applications/operationalStudies/hooks/useManageTrainScheduleContext';
import useScenarioData from 'applications/operationalStudies/hooks/useScenarioData';
import ImportTrainSchedule from 'applications/operationalStudies/views/ImportTrainSchedule';
import ManageTrainSchedule from 'applications/operationalStudies/views/ManageTrainSchedule';
import SimulationResults from 'applications/operationalStudies/views/SimulationResults';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { InfraWithState, ScenarioResponse } from 'common/api/osrdEditoastApi';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import TimetableManageTrainSchedule from 'modules/trainschedule/components/ManageTrainSchedule/TimetableManageTrainSchedule';
import Timetable from 'modules/trainschedule/components/Timetable/Timetable';
import type { TimetableItemId, TrainScheduleResultWithTrainId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import ScenarioDescription from './ScenarioDescription';
import MacroEditorState from '../MacroEditor/MacroEditorState';

type ScenarioDescriptionProps = {
  scenario: ScenarioResponse;
  infra: InfraWithState;
  infraMetadata: { isInfraLoaded: boolean; reloadCount: number };
};

const ScenarioContent = ({
  scenario,
  infra,
  infraMetadata: { isInfraLoaded, reloadCount },
}: ScenarioDescriptionProps) => {
  const { t } = useTranslation('operationalStudies/scenario');
  const dispatch = useAppDispatch();

  const [displayTrainScheduleManagement, setDisplayTrainScheduleManagement] = useState<string>(
    MANAGE_TRAIN_SCHEDULE_TYPES.none
  );
  const [collapsedTimetable, setCollapsedTimetable] = useState(false);
  const [itemIdToEdit, setItemIdToEdit] = useState<TimetableItemId>();
  const [isMacro, setIsMacro] = useState(false);
  const {
    trainScheduleSummaries,
    trainSchedules,
    projectionData,
    conflicts,
    upsertTrainSchedules,
    removeTrains,
    updateTrainDepartureTime,
  } = useScenarioData(scenario, infra);
  const macroEditorState = useRef<MacroEditorState>();
  const [ngeDto, setNgeDto] = useState<NetzgrafikDto>();

  const dtoImport = useCallback(async () => {
    const timetablePromise = dispatch(
      osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.initiate(
        { timetableId: scenario?.timetable_id },
        { forceRefetch: true, subscribe: false }
      )
    );
    const schedules = (await timetablePromise.unwrap()).filter(
      (trainSchedule) => trainSchedule.path.length >= 2
    );
    const state = new MacroEditorState(scenario, schedules || []);
    await loadAndIndexNge(state, dispatch);
    const dto = getNgeDto(state);
    macroEditorState.current = state;
    setNgeDto(dto);
  }, [dispatch, scenario, scenario.timetable_id]);

  const toggleMicroMacroButton = useCallback(
    (isMacroMode: boolean) => {
      setIsMacro(isMacroMode);
      if (!isMacroMode && collapsedTimetable) {
        setCollapsedTimetable(false);
      }
    },
    [setIsMacro, collapsedTimetable]
  );

  useEffect(() => {
    if (isMacro) {
      dtoImport();
    }
  }, [isMacro]);

  const handleNGEOperation = (event: NGEEvent, netzgrafikDto: NetzgrafikDto) => {
    handleOperation({
      event,
      state: macroEditorState.current!,
      dispatch,
      infraId: infra.id,
      timeTableId: scenario.timetable_id,
      netzgrafikDto,
      addUpsertedTrainSchedules: (upsertedTrainSchedules: TrainScheduleResultWithTrainId[]) => {
        upsertTrainSchedules(upsertedTrainSchedules);
      },
      addDeletedTrainIds: (trainIds: TimetableItemId[]) => {
        removeTrains(trainIds);
      },
    });
  };

  return (
    <main className="mastcontainer mastcontainer-no-mastnav scenario">
      <div className="row no-gutters h-100">
        <div
          data-testid="scenario-sidemenu"
          className={cx(
            'h-100',
            collapsedTimetable ? 'd-none' : 'col-hdp-3 col-xl-4 col-lg-5 col-md-6'
          )}
        >
          <div className="scenario-sidemenu">
            <ScenarioDescription
              scenario={scenario}
              infra={infra}
              infraReloadCount={reloadCount}
              collapseTimetable={() => setCollapsedTimetable(true)}
            />

            <MicroMacroSwitch isMacro={isMacro} setIsMacro={toggleMicroMacroButton} />

            {infra && (
              <>
                {displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.none && (
                  <TimetableManageTrainSchedule
                    displayTrainScheduleManagement={displayTrainScheduleManagement}
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                    upsertTrainSchedules={upsertTrainSchedules}
                    itemIdToEdit={itemIdToEdit}
                    setItemIdToEdit={setItemIdToEdit}
                    infraState={infra.state}
                    dtoImport={dtoImport}
                  />
                )}
                <Timetable
                  setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                  infraState={infra.state}
                  conflicts={conflicts}
                  upsertTrainSchedules={upsertTrainSchedules}
                  removeTrains={removeTrains}
                  setItemIdToEdit={setItemIdToEdit}
                  itemIdToEdit={itemIdToEdit}
                  trainSchedules={trainSchedules}
                  trainSchedulesWithDetails={trainScheduleSummaries}
                  dtoImport={dtoImport}
                />
              </>
            )}
          </div>
        </div>

        <div
          className={cx(
            'h-100',
            collapsedTimetable ? 'col-12' : 'col-hdp-9 col-xl-8 col-lg-7 col-md-6'
          )}
        >
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
            !isMacro &&
            displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.add &&
            displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.edit && (
              <ScenarioLoaderMessage infraState={infra?.state} />
            )}
          {(displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
            displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit) && (
            <div className="scenario-managetrainschedule">
              <ManageTrainScheduleContextProvider>
                <ManageTrainSchedule />
              </ManageTrainScheduleContextProvider>
            </div>
          )}
          {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.import && (
            <div className="scenario-managetrainschedule">
              <ImportTrainSchedule
                timetableId={scenario.timetable_id}
                upsertTrainSchedules={upsertTrainSchedules}
                dtoImport={dtoImport}
              />
            </div>
          )}
          <div className="scenario-results">
            {isMacro ? (
              <div className="h-100 p-1">
                <NGE dto={ngeDto} onOperation={handleNGEOperation} />
              </div>
            ) : (
              isInfraLoaded &&
              infra && (
                <SimulationResults
                  scenarioData={{ name: scenario.name, infraName: scenario.infra_name }}
                  collapsedTimetable={collapsedTimetable}
                  projectionData={projectionData}
                  infraId={infra.id}
                  conflicts={conflicts}
                  trainScheduleSummaries={trainScheduleSummaries}
                  updateTrainDepartureTime={updateTrainDepartureTime}
                />
              )
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default ScenarioContent;
