import React, { useEffect, useMemo, useState } from 'react';

import { Pencil, Eye, EyeClosed, ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { GiElectric } from 'react-icons/gi';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import getSimulationResults, {
  selectProjection,
} from 'applications/operationalStudies/components/Scenario/getSimulationResults';
import InfraLoadingState from 'applications/operationalStudies/components/Scenario/InfraLoadingState';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import ImportTrainSchedule from 'applications/operationalStudies/views/ImportTrainSchedule';
import ManageTrainSchedule from 'applications/operationalStudies/views/ManageTrainSchedule';
import SimulationResults from 'applications/operationalStudies/views/SimulationResults';
import infraLogo from 'assets/pictures/components/tracks.svg';
import { type SimulationReport, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { useInfraID, useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import AddAndEditScenarioModal from 'modules/scenario/components/AddOrEditScenarioModal';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import Timetable from 'modules/trainschedule/components/Timetable/Timetable';
import TimetableManageTrainSchedule from 'modules/trainschedule/components/Timetable/TimetableManageTrainSchedule';
import type { RootState } from 'reducers';
import { updateSelectedProjection, updateSimulation } from 'reducers/osrdsimulation/actions';
import {
  getAllowancesSettings,
  getPresentSimulation,
  getSelectedProjection,
  getSelectedTrainId,
} from 'reducers/osrdsimulation/selectors';
import { useAppDispatch } from 'store';

type SimulationParams = {
  projectId: string;
  studyId: string;
  scenarioId: string;
};

export default function Scenario() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operationalStudies/scenario');
  const [displayTrainScheduleManagement, setDisplayTrainScheduleManagement] = useState<string>(
    MANAGE_TRAIN_SCHEDULE_TYPES.none
  );
  const [trainsWithDetails, setTrainsWithDetails] = useState(false);
  const [collapsedTimetable, setCollapsedTimetable] = useState(false);
  const [isInfraLoaded, setIsInfraLoaded] = useState(false);
  const [reloadCount, setReloadCount] = useState(1);
  const [trainResultsToFetch, setTrainResultsToFetch] = useState<number[] | undefined>();
  const isUpdating = useSelector((state: RootState) => state.osrdsimulation.isUpdating);

  const { openModal } = useModal();

  const {
    projectId: urlProjectId,
    studyId: urlStudyId,
    scenarioId: urlScenarioId,
  } = useParams() as SimulationParams;

  const { getTimetableID } = useOsrdConfSelectors();
  const infraId = useInfraID();
  const timetableId = useSelector(getTimetableID);
  const selectedTrainId = useSelector(getSelectedTrainId);
  const selectedProjection = useSelector(getSelectedProjection);
  const allowancesSettings = useSelector(getAllowancesSettings);
  const simulation = useSelector(getPresentSimulation);

  const { projectId, studyId, scenarioId } = useMemo(
    () => ({
      projectId: !Number.isNaN(+urlProjectId) ? +urlProjectId : undefined,
      studyId: !Number.isNaN(+urlStudyId) ? +urlStudyId : undefined,
      scenarioId: !Number.isNaN(+urlScenarioId) ? +urlScenarioId : undefined,
    }),
    [urlStudyId, urlProjectId, urlScenarioId]
  );

  const {
    data: scenario,
    isError: isScenarioError,
    error: errorScenario,
  } = osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useQuery(
    {
      projectId: projectId!,
      studyId: studyId!,
      scenarioId: scenarioId!,
    },
    {
      skip: !projectId || !studyId || !scenarioId,
    }
  );

  useEffect(() => {
    if (isScenarioError && errorScenario) throw errorScenario;
  }, [isScenarioError, errorScenario]);

  const { updateInfraID, updateTimetableID } = useOsrdConfActions();

  useEffect(() => {
    if (scenario) {
      dispatch(updateTimetableID(scenario.timetable_id));
      dispatch(updateInfraID(scenario.infra_id));
    }
  }, [scenario]);

  const { data: infra } = osrdEditoastApi.endpoints.getInfraById.useQuery(
    { id: infraId as number },
    {
      skip: !infraId,
      refetchOnMountOrArgChange: true,
      pollingInterval: !isInfraLoaded ? 1000 : undefined,
    }
  );
  const [reloadInfra] = osrdEditoastApi.endpoints.postInfraByIdLoad.useMutation();

  useEffect(() => {
    if (reloadCount <= 5 && infra && infra.state === 'TRANSIENT_ERROR') {
      setTimeout(() => {
        reloadInfra({ id: infraId as number }).unwrap();
        setReloadCount((count) => count + 1);
      }, 1000);
    }
  }, [infra, reloadCount]);

  useEffect(() => {
    if (infra && (infra.state === 'NOT_LOADED' || infra.state === 'DOWNLOADING')) {
      setIsInfraLoaded(false);
    }

    if (
      infra &&
      (infra.state === 'CACHED' || infra.state === 'ERROR' || infra.state === 'TRANSIENT_ERROR')
    ) {
      setIsInfraLoaded(true);
    }
  }, [infra]);

  useEffect(() => {
    if (infraId) {
      reloadInfra({ id: infraId as number }).unwrap();
    }
  }, [infraId]);

  /*
   * Timetable is refetched automatically if a train schedule is updated or deleted
   * but not if one is created (in importTrainScheduleModal, we don't want to refetch
   * the timetable each time a train is created), that is why the refetch is needed here
   */
  const { data: timetable, refetch: refetchTimetable } =
    osrdEditoastApi.endpoints.getTimetableById.useQuery(
      { id: timetableId as number },
      {
        skip: !timetableId,
        // This cause the timetable to refetch each time the component mounts
        refetchOnMountOrArgChange: true,
      }
    );

  const { data: conflicts = [], refetch: refetchConflicts } =
    osrdEditoastApi.endpoints.getTimetableByIdConflicts.useQuery(
      { id: timetable?.id as number },
      { skip: !timetable }
    );

  useEffect(() => {
    if (timetable && infra?.state === 'CACHED' && timetable.train_schedule_summaries.length > 0) {
      selectProjection(timetable.train_schedule_summaries, selectedProjection, selectedTrainId);
    }
  }, [timetable, infra]);

  useEffect(() => {
    if (timetable && infra?.state === 'CACHED' && selectedProjection) {
      // If trainResultsToFetch is undefined that means it's the first load of the scenario
      // and we want to get all timetable trains results
      if (trainResultsToFetch) {
        getSimulationResults(
          trainResultsToFetch,
          selectedProjection,
          allowancesSettings,
          simulation.trains as SimulationReport[]
        );
      } else {
        const trainScheduleIds = timetable.train_schedule_summaries.map((train) => train.id);
        getSimulationResults(trainScheduleIds, selectedProjection, allowancesSettings);
      }
    }
  }, [timetable, infra, selectedProjection]);

  useEffect(() => {
    if (!projectId || !studyId || !scenarioId) {
      throw new Error('Missing projectId, studyId or scenarioId');
    }
  }, [projectId, studyId, scenarioId]);

  useEffect(
    () => () => {
      dispatch(updateTimetableID(undefined));
      dispatch(updateInfraID(undefined));
      dispatch(updateSimulation({ trains: [] }));
      dispatch(updateSelectedProjection(undefined));
    },
    []
  );

  if (!scenario || !infraId || !timetableId) return null;

  return (
    <>
      <NavBarSNCF
        appName={
          <BreadCrumbs project={scenario?.project} study={scenario?.study} scenario={scenario} />
        }
      />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="scenario">
          <div className="row scenario-container">
            <div className={collapsedTimetable ? 'd-none' : 'col-hdp-3 col-xl-4 col-lg-5 col-md-6'}>
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
                          <img src={infraLogo} alt="Infra logo" className="mr-2" />
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
                          {scenario.electrical_profile_set_name
                            ? scenario.electrical_profile_set_name
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
                {displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.none && infra && (
                  <TimetableManageTrainSchedule
                    displayTrainScheduleManagement={displayTrainScheduleManagement}
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                    setTrainResultsToFetch={setTrainResultsToFetch}
                    infraState={infra.state}
                    refetchTimetable={refetchTimetable}
                    refetchConflicts={refetchConflicts}
                  />
                )}
                {infra && (
                  <Timetable
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                    trainsWithDetails={trainsWithDetails}
                    infraState={infra.state}
                    timetable={timetable}
                    selectedTrainId={selectedTrainId}
                    refetchTimetable={refetchTimetable}
                    conflicts={conflicts}
                    setTrainResultsToFetch={setTrainResultsToFetch}
                    simulation={simulation}
                  />
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
                  <ManageTrainSchedule />
                </div>
              )}
              {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.import && (
                <div className="scenario-managetrainschedule">
                  <ImportTrainSchedule infraId={infraId} timetableId={timetableId} />
                </div>
              )}
              <div className="scenario-results">
                {collapsedTimetable && (
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
                      <img src={infraLogo} alt="Infra logo" className="mr-2" height="16" />
                      {scenario.infra_name}
                    </div>
                    <div className="d-flex align-items-center ml-4">
                      <span className="mr-1">
                        <GiElectric />
                      </span>
                      {scenario.electrical_profile_set_name
                        ? scenario.electrical_profile_set_name
                        : t('noElectricalProfileSet')}
                    </div>
                  </div>
                )}
                {isInfraLoaded && infra && (
                  <SimulationResults
                    collapsedTimetable={collapsedTimetable}
                    setTrainResultsToFetch={setTrainResultsToFetch}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
