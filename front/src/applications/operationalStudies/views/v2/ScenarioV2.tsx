import { useState, useEffect } from 'react';

import { ChevronLeft, ChevronRight, Eye, EyeClosed, Pencil } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { GiElectric } from 'react-icons/gi';
import { useSelector } from 'react-redux';

import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import handleOperation from 'applications/operationalStudies/components/MacroEditor/ngeToOsrd';
import importTimetableToNGE from 'applications/operationalStudies/components/MacroEditor/osrdToNge';
import MicroMacroSwitch from 'applications/operationalStudies/components/MicroMacroSwitch';
import NGE from 'applications/operationalStudies/components/NGE/NGE';
import type { NetzgrafikDto, NGEEvent } from 'applications/operationalStudies/components/NGE/types';
import InfraLoadingState from 'applications/operationalStudies/components/Scenario/InfraLoadingState';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import infraLogo from 'assets/pictures/components/tracks.svg';
import type { TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import AddAndEditScenarioModal from 'modules/scenario/components/AddOrEditScenarioModal';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import TimetableManageTrainScheduleV2 from 'modules/trainschedule/components/ManageTrainSchedule/TimetableManageTrainScheduleV2';
import TimetableV2 from 'modules/trainschedule/components/TimetableV2/TimetableV2';
import type { RootState } from 'reducers';
import { useAppDispatch } from 'store';
import { concatMap, mapBy } from 'utils/types';

import ImportTrainScheduleV2 from './ImportTrainScheduleV2';
import ManageTrainScheduleV2 from './ManageTrainScheduleV2';
import SimulationResultsV2 from './SimulationResultsV2';
import useScenarioData from '../../hooks/useScenarioData';

const Scenario = () => {
  const { t } = useTranslation('operationalStudies/scenario');
  const dispatch = useAppDispatch();
  const isUpdating = useSelector((state: RootState) => state.osrdsimulation.isUpdating);

  const [displayTrainScheduleManagement, setDisplayTrainScheduleManagement] = useState<string>(
    MANAGE_TRAIN_SCHEDULE_TYPES.none
  );
  const [trainsWithDetails, setTrainsWithDetails] = useState(false);
  const [collapsedTimetable, setCollapsedTimetable] = useState(false);
  const [trainIdToEdit, setTrainIdToEdit] = useState<number>();
  const [isMacro, setIsMacro] = useState(false);

  const { openModal } = useModal();

  const scenarioData = useScenarioData();

  const toggleMicroMacroButton = (isMacroMode: boolean) => {
    setIsMacro(isMacroMode);
    setCollapsedTimetable(isMacroMode);
  };

  const [ngeDto, setNgeDto] = useState<NetzgrafikDto>();
  const [ngeUpsertedTrainSchedules, setNgeUpsertedTrainSchedules] = useState<
    Map<number, TrainScheduleResult>
  >(new Map());
  const [ngeDeletedTrainIds, setNgeDeletedTrainIds] = useState<number[]>([]);

  useEffect(() => {
    if (!scenarioData || !isMacro || (isMacro && ngeDto)) {
      return;
    }

    const { scenario } = scenarioData;
    const doImport = async () => {
      const dto = await importTimetableToNGE(scenario.infra_id, scenario.timetable_id, dispatch);
      setNgeDto(dto);
    };
    doImport();
  }, [scenarioData, isMacro]);

  useEffect(() => {
    if (isMacro) {
      return;
    }

    if (ngeDto) {
      setNgeDto(undefined);
    }
    if (scenarioData) {
      const { upsertTrainSchedules, removeTrains } = scenarioData;
      upsertTrainSchedules(Array.from(ngeUpsertedTrainSchedules.values()));
      removeTrains(ngeDeletedTrainIds);
    }
  }, [isMacro]);

  if (!scenarioData) return null;

  const {
    scenario,
    timetable,
    infraId,
    selectedTrainId,
    infra: { infra, isInfraLoaded, reloadCount },
    trainScheduleSummaries,
    trainSchedules,
    trainScheduleUsedForProjection,
    trainIdUsedForProjection,
    projectedTrains,
    simulationResults,
    conflicts,
    upsertTrainSchedules,
    removeTrains,
  } = scenarioData;

  const handleNGEOperation = (event: NGEEvent, netzgrafikDto: NetzgrafikDto) =>
    handleOperation({
      event,
      dispatch,
      timeTableId: scenarioData!.scenario.timetable_id,
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
    <>
      <NavBarSNCF
        appName={
          <BreadCrumbs project={scenario.project} study={scenario.study} scenario={scenario} />
        }
      />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="scenario">
          <div className="row scenario-container">
            <div
              className={`scenario-sidemenu ${collapsedTimetable ? 'd-none' : 'col-hdp-3 col-xl-4 col-lg-5 col-md-6'}`}
            >
              <div className="scenario-sidemenu">
                {scenario && (
                  <div className="scenario-details">
                    <div className="scenario-details-name">
                      <span
                        className="flex-grow-1 scenario-name text-truncate"
                        title={scenario.name}
                      >
                        {scenario.name}
                      </span>
                      <button
                        data-testid="editScenario"
                        className="scenario-details-modify-button"
                        type="button"
                        aria-label={t('editScenario')}
                        onClick={() =>
                          openModal(
                            <AddAndEditScenarioModal editionMode scenario={scenario} />,
                            'xl',
                            'no-close-modal'
                          )
                        }
                        title={t('editScenario')}
                      >
                        <Pencil />
                      </button>
                      <button
                        type="button"
                        className="scenario-details-modify-button"
                        onClick={() => setTrainsWithDetails(!trainsWithDetails)}
                        title={t('displayTrainsWithDetails')}
                      >
                        {trainsWithDetails ? <EyeClosed /> : <Eye />}
                      </button>
                      <button
                        type="button"
                        className="scenario-details-modify-button"
                        aria-label={t('toggleTimetable')}
                        onClick={() => setCollapsedTimetable(true)}
                      >
                        <ChevronLeft />
                      </button>
                    </div>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="scenario-details-infra-name">
                          <img src={infraLogo} alt="Infra logo" className="infra-logo mr-2" />
                          {infra && <InfraLoadingState infra={infra} />}
                          <span className="scenario-infra-name">{scenario.infra_name}</span>
                          <small className="ml-auto text-muted">ID {scenario.infra_id}</small>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="scenario-details-electrical-profile-set">
                          <span className="mr-2">
                            <GiElectric />
                          </span>
                          {scenario.electrical_profile_set_id
                            ? scenario.electrical_profile_set_id
                            : t('noElectricalProfileSet')}
                        </div>
                      </div>
                    </div>
                    {infra &&
                      infra.state === 'TRANSIENT_ERROR' &&
                      (reloadCount <= 5 ? (
                        <div className="scenario-details-infra-error mt-1">
                          {t('errorMessages.unableToLoadInfra', { reloadCount })}
                        </div>
                      ) : (
                        <div className="scenario-details-infra-error mt-1">
                          {t('errorMessages.softErrorInfra')}
                        </div>
                      ))}
                    {infra && infra.state === 'ERROR' && (
                      <div className="scenario-details-infra-error mt-1">
                        {t('errorMessages.hardErrorInfra')}
                      </div>
                    )}
                    <div className="scenario-details-description">{scenario.description}</div>
                  </div>
                )}
                <MicroMacroSwitch isMacro={isMacro} setIsMacro={toggleMicroMacroButton} />
                {!isMacro && (
                  <>
                    {displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.none &&
                      infra && (
                        <TimetableManageTrainScheduleV2
                          displayTrainScheduleManagement={displayTrainScheduleManagement}
                          setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                          upsertTrainSchedules={upsertTrainSchedules}
                          trainIdToEdit={trainIdToEdit}
                          setTrainIdToEdit={setTrainIdToEdit}
                          infraState={infra.state}
                        />
                      )}
                    {infra && (
                      <TimetableV2
                        setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                        trainsWithDetails={trainsWithDetails}
                        infraState={infra.state}
                        trainIds={timetable.train_ids}
                        selectedTrainId={selectedTrainId}
                        conflicts={conflicts}
                        upsertTrainSchedules={upsertTrainSchedules}
                        removeTrains={removeTrains}
                        setTrainIdToEdit={setTrainIdToEdit}
                        trainIdToEdit={trainIdToEdit}
                        trainSchedules={trainSchedules}
                        trainSchedulesWithDetails={trainScheduleSummaries}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            <div className={collapsedTimetable ? 'col-12' : 'col-hdp-9 col-xl-8 col-lg-7 col-md-6'}>
              {(!isInfraLoaded || isUpdating) &&
                displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.add &&
                displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.edit && (
                  <ScenarioLoaderMessage infraState={infra?.state} />
                )}
              {(displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
                displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit) && (
                <div className="scenario-managetrainschedule">
                  <ManageTrainScheduleV2 trainIdToEdit={trainIdToEdit} />
                </div>
              )}
              {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.import && (
                <div className="scenario-managetrainschedule">
                  <ImportTrainScheduleV2 timetableId={scenario.timetable_id} />
                </div>
              )}
              <div className="scenario-results">
                {collapsedTimetable && (
                  <>
                    <div className="scenario-timetable-collapsed">
                      <button
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
                    <SimulationResultsV2
                      collapsedTimetable={collapsedTimetable}
                      spaceTimeData={projectedTrains}
                      simulationResults={simulationResults}
                      trainScheduleUsedForProjection={trainScheduleUsedForProjection}
                      trainIdUsedForProjection={trainIdUsedForProjection}
                      infraId={infraId}
                      timetableTrainNb={timetable.train_ids.length}
                    />
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default Scenario;
