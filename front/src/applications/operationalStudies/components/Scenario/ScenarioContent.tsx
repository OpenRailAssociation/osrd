import { useState, useEffect, useCallback } from 'react';

import { ChevronRight } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { GiElectric } from 'react-icons/gi';

import handleOperation from 'applications/operationalStudies/components/MacroEditor/ngeToOsrd';
import importTimetableToNGE from 'applications/operationalStudies/components/MacroEditor/osrdToNge';
import MicroMacroSwitch from 'applications/operationalStudies/components/MicroMacroSwitch';
import NGE from 'applications/operationalStudies/components/NGE/NGE';
import type { NetzgrafikDto, NGEEvent } from 'applications/operationalStudies/components/NGE/types';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import useScenarioData from 'applications/operationalStudies/hooks/useScenarioData';
import ImportTrainSchedule from 'applications/operationalStudies/views/ImportTrainSchedule';
import ManageTrainSchedule from 'applications/operationalStudies/views/ManageTrainSchedule';
import SimulationResults from 'applications/operationalStudies/views/SimulationResults';
import infraLogo from 'assets/pictures/components/tracks.svg';
import type {
  InfraWithState,
  ScenarioResponse,
  TimetableDetailedResult,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import TimetableManageTrainSchedule from 'modules/trainschedule/components/ManageTrainSchedule/TimetableManageTrainSchedule';
import Timetable from 'modules/trainschedule/components/Timetable/Timetable';
import { useAppDispatch } from 'store';
import { concatMap, mapBy } from 'utils/types';

import ScenarioDescription from './ScenarioDescription';

type ScenarioDescriptionProps = {
  scenario: ScenarioResponse;
  timetable: TimetableDetailedResult;
  infra: InfraWithState;
  infraMetadata: { isInfraLoaded: boolean; reloadCount: number };
};

const ScenarioContent = ({
  scenario,
  timetable,
  infra,
  infraMetadata: { isInfraLoaded, reloadCount },
}: ScenarioDescriptionProps) => {
  const { t } = useTranslation('operationalStudies/scenario');
  const dispatch = useAppDispatch();

  const [displayTrainScheduleManagement, setDisplayTrainScheduleManagement] = useState<string>(
    MANAGE_TRAIN_SCHEDULE_TYPES.none
  );
  const [collapsedTimetable, setCollapsedTimetable] = useState(false);
  const [trainIdToEdit, setTrainIdToEdit] = useState<number>();
  const [isMacro, setIsMacro] = useState(false);

  const {
    selectedTrainId,
    trainScheduleSummaries,
    trainSchedules,
    projectionData: projection,
    simulationResults,
    conflicts,
    upsertTrainSchedules,
    removeTrains,
  } = useScenarioData(scenario, timetable, infra);

  const toggleMicroMacroButton = useCallback(
    (isMacroMode: boolean) => {
      setIsMacro(isMacroMode);
      setCollapsedTimetable(isMacroMode);
    },
    [setIsMacro, setCollapsedTimetable]
  );

  const [ngeDto, setNgeDto] = useState<NetzgrafikDto>();
  const [ngeUpsertedTrainSchedules, setNgeUpsertedTrainSchedules] = useState<
    Map<number, TrainScheduleResult>
  >(new Map());
  const [ngeDeletedTrainIds, setNgeDeletedTrainIds] = useState<number[]>([]);

  useEffect(() => {
    if (!isMacro || (isMacro && ngeDto)) {
      return;
    }

    const doImport = async () => {
      const dto = await importTimetableToNGE(scenario.infra_id, scenario.timetable_id, dispatch);
      setNgeDto(dto);
    };
    doImport();
  }, [scenario, isMacro]);

  useEffect(() => {
    if (isMacro) {
      return;
    }

    if (ngeDto) {
      setNgeDto(undefined);
    }
    upsertTrainSchedules(Array.from(ngeUpsertedTrainSchedules.values()));
    removeTrains(ngeDeletedTrainIds);
  }, [isMacro]);

  const handleNGEOperation = (event: NGEEvent, netzgrafikDto: NetzgrafikDto) =>
    handleOperation({
      event,
      dispatch,
      infraId: infra.id,
      timeTableId: scenario.timetable_id,
      netzgrafikDto,
      addUpsertedTrainSchedules: (upsertedTrainSchedules: TrainScheduleResult[]) => {
        setNgeUpsertedTrainSchedules((prev) =>
          concatMap(prev, mapBy(upsertedTrainSchedules, 'id'))
        );
      },
      addDeletedTrainIds: (trainIds: number[]) => {
        setNgeDeletedTrainIds((prev) => [...prev, ...trainIds]);
      },
    });

  return (
    <main className="mastcontainer mastcontainer-no-mastnav">
      <div className="scenario">
        <div className="row scenario-container">
          <div
            data-testid="scenario-sidemenu"
            className={`scenario-sidemenu ${collapsedTimetable ? 'd-none' : 'col-hdp-3 col-xl-4 col-lg-5 col-md-6'}`}
          >
            <div className="scenario-sidemenu">
              <ScenarioDescription
                scenario={scenario}
                infra={infra}
                infraReloadCount={reloadCount}
                collapseTimetable={() => setCollapsedTimetable(true)}
              />
              <MicroMacroSwitch isMacro={isMacro} setIsMacro={toggleMicroMacroButton} />
              {!isMacro && infra && (
                <>
                  {displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.none && (
                    <TimetableManageTrainSchedule
                      displayTrainScheduleManagement={displayTrainScheduleManagement}
                      setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                      upsertTrainSchedules={upsertTrainSchedules}
                      trainIdToEdit={trainIdToEdit}
                      setTrainIdToEdit={setTrainIdToEdit}
                      infraState={infra.state}
                    />
                  )}
                  <Timetable
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                    infraState={infra.state}
                    selectedTrainId={selectedTrainId}
                    conflicts={conflicts}
                    upsertTrainSchedules={upsertTrainSchedules}
                    removeTrains={removeTrains}
                    setTrainIdToEdit={setTrainIdToEdit}
                    trainIdToEdit={trainIdToEdit}
                    trainSchedules={trainSchedules}
                    trainSchedulesWithDetails={trainScheduleSummaries}
                  />
                </>
              )}
            </div>
          </div>

          <div className={collapsedTimetable ? 'col-12' : 'col-hdp-9 col-xl-8 col-lg-7 col-md-6'}>
            {!isInfraLoaded &&
              !isMacro &&
              displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.add &&
              displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.edit && (
                <ScenarioLoaderMessage infraState={infra?.state} />
              )}
            {(displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
              displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit) && (
              <div className="scenario-managetrainschedule">
                <ManageTrainSchedule trainIdToEdit={trainIdToEdit} />
              </div>
            )}
            {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.import && (
              <div className="scenario-managetrainschedule">
                <ImportTrainSchedule
                  timetableId={scenario.timetable_id}
                  upsertTrainSchedules={upsertTrainSchedules}
                />
              </div>
            )}
            <div className="scenario-results">
              {collapsedTimetable && (
                <>
                  <div className="scenario-timetable-collapsed">
                    <button
                      data-testid="timetable-collapse-button"
                      className="timetable-collapse-button"
                      type="button"
                      aria-label={t('toggleTimetable')}
                      onClick={() => setCollapsedTimetable(false)}
                    >
                      <ChevronRight />
                    </button>
                    <div className="lead ml-2">{scenario.name}</div>
                    <div className="d-flex align-items-center ml-auto">
                      <img src={infraLogo} alt="Infra logo" className="infra-logo mr-2" />
                      {scenario.infra_name}
                    </div>
                    <div className="d-flex align-items-center ml-4">
                      <span className="mr-1">
                        <GiElectric />
                      </span>
                      {scenario.electrical_profile_set_id
                        ? scenario.electrical_profile_set_id
                        : t('noElectricalProfileSet')}
                    </div>
                  </div>
                  <MicroMacroSwitch isMacro={isMacro} setIsMacro={toggleMicroMacroButton} />
                </>
              )}
              {isMacro ? (
                <div className={cx(collapsedTimetable ? 'macro-container' : 'h-100')}>
                  <NGE dto={ngeDto} onOperation={handleNGEOperation} />
                </div>
              ) : (
                isInfraLoaded &&
                infra && (
                  <SimulationResults
                    collapsedTimetable={collapsedTimetable}
                    projectionData={projection}
                    simulationResults={simulationResults}
                    infraId={infra.id}
                    timetableTrainNb={timetable.train_ids.length}
                    conflicts={conflicts}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ScenarioContent;
